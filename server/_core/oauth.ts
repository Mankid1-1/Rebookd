import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users as usersTable } from "../../drizzle/schema";
import * as AuthService from "../services/auth.service";
import * as UserService from "../services/user.service";
import { getSessionCookieOptions } from "./cookies";
import { sendEmail } from "./email";
import { sdk } from "./sdk";
import { ENV } from "./env";

function legacyHashPassword(password: string): string {
  return createHash("sha256")
    .update(password + (ENV.cookieSecret || "rebooked-salt"))
    .digest("hex");
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (storedHash.startsWith("$2")) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: false };
  }
  // Legacy SHA-256 hash — verify but flag for rehash
  const valid = storedHash === legacyHashPassword(password);
  return { valid, needsRehash: valid };
}

function generateOpenId(): string {
  return "local_" + randomBytes(16).toString("hex");
}

function appUrl(req: Request) {
  return process.env.APP_URL || `${req.protocol}://${req.get("host") || "localhost:3000"}`;
}

async function sendVerificationEmail(email: string, token: string, req: Request) {
  const verifyUrl = `${appUrl(req)}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Verify your Rebooked email",
    text: `Verify your Rebooked account: ${verifyUrl}`,
    html: `<p>Verify your Rebooked account.</p><p><a href="${verifyUrl}">Verify email</a></p>`,
  });
}

async function sendResetEmail(email: string, token: string, req: Request) {
  const resetUrl = `${appUrl(req)}/login?mode=reset&token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Reset your Rebooked password",
    text: `Reset your password: ${resetUrl}`,
    html: `<p>Reset your password.</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
}

async function verifyTurnstile(token: string | undefined, req: Request): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // No Turnstile keys configured — fall back to honeypot-only spam protection
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (req.ip) body.set("remoteip", req.ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return false;
  const payload = await response.json() as { success?: boolean };
  return !!payload.success;
}

function getLoginPageState(req: Request) {
  const mode = req.query.mode === "reset" ? "reset" : "signin";
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const type = typeof req.query.type === "string" ? req.query.type : "";
  const error = typeof req.query.error === "string" ? req.query.error : "";
  return { mode, token, status, type, error };
}

export function registerOAuthRoutes(app: Express) {
  app.get("/login", (req: Request, res: Response) => {
    res.send(loginPageHtml(getLoginPageState(req)));
  });

  app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      res.redirect(302, "/login?status=verify-missing");
      return;
    }
    try {
      const database = await getDb();
      if (!database) throw new Error("Database unavailable");
      const row = await AuthService.consumeEmailVerificationToken(database, token);
      if (!row) {
        res.redirect(302, "/login?status=verify-invalid");
        return;
      }
      const user = await UserService.getUserById(database, row.userId);
      if (!user) {
        res.redirect(302, "/login?status=verify-invalid");
        return;
      }
      await UserService.verifyUserEmail(database, user.id);
      res.redirect(302, "/login?status=verify-success");
    } catch (error) {
      console.error("[Auth] Verify email failed", error);
      res.redirect(302, "/login?status=verify-error");
    }
  });

  app.post("/api/auth/signin", async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    try {
      const database = await getDb();
      if (!database) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }
      const user = await UserService.getUserByEmail(database, email.toLowerCase().trim());
      if (!user || (user.loginMethod !== "local" && user.loginMethod !== "password")) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      if (!user.passwordHash) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        const { recordFailedAuth } = await import("./security");
        recordFailedAuth(req.ip || "unknown");
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      // Transparently upgrade legacy SHA-256 hashes to bcrypt
      if (needsRehash) {
        const newHash = await hashPassword(password);
        await UserService.setUserPasswordHash(database, user.id, newHash);
      }
      if (!user.emailVerifiedAt) {
        const token = await AuthService.createEmailVerificationToken(database, user.id, user.email || email);
        await sendVerificationEmail(user.email || email, token, req);
        res.status(403).json({ error: "Verify your email before signing in. We sent a fresh link." });
        return;
      }

      const { clearFailedAuth } = await import("./security");
      clearFailedAuth(req.ip || "unknown");
      const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (not 1 year)
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || email,
        expiresInMs: SESSION_MAX_AGE_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
      await UserService.updateLastSignedIn(database, user.id);
      res.json({ ok: true, accountType: user.role === 'admin' ? 'admin' : ((user as any).accountType || 'business') });
    } catch (error) {
      console.error("[Auth] Sign in failed", error);
      res.status(500).json({ error: "Sign in failed" });
    }
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const { email, password, name, website, captchaToken, accountType } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      website?: string;
      captchaToken?: string;
      accountType?: 'business' | 'referral';
    };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    if (website) {
      res.status(400).json({ error: "Spam protection triggered" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    if (!(await verifyTurnstile(captchaToken, req))) {
      res.status(400).json({ error: "Complete the verification challenge and try again." });
      return;
    }

    try {
      const database = await getDb();
      if (!database) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }
      const normalizedEmail = email.toLowerCase().trim();
      const requestedType = accountType === 'referral' ? 'referral' : 'business';
      const existing = await UserService.getUserByEmail(database, normalizedEmail);
      if (existing?.emailVerifiedAt) {
        // If user already has one account type and is requesting the other, upgrade to "both"
        const currentType = existing.accountType;
        if (currentType !== 'both' && currentType !== requestedType) {
          await database.update(usersTable).set({ accountType: 'both' }).where(eq(usersTable.id, existing.id));
          res.json({ ok: true, upgraded: true, message: "Your account now has both business and referral capabilities." });
          return;
        }
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }

      if (existing && !existing.emailVerifiedAt) {
        const token = await AuthService.createEmailVerificationToken(database, existing.id, normalizedEmail);
        await sendVerificationEmail(normalizedEmail, token, req);
        res.json({ ok: true, pendingVerification: true });
        return;
      }

      const openId = generateOpenId();
      const passwordHash = await hashPassword(password);
      await UserService.createUser(database, {
        openId,
        name: name?.trim() || email.split("@")[0],
        email: normalizedEmail,
        loginMethod: "local",
        passwordHash,
        accountType: accountType === 'referral' ? 'referral' : 'business',
        lastSignedIn: new Date(),
      });
      const user = await UserService.getUserByOpenId(database, openId);
      if (!user) throw new Error("User creation failed");

      const token = await AuthService.createEmailVerificationToken(database, user.id, normalizedEmail);
      await sendVerificationEmail(normalizedEmail, token, req);
      res.json({ ok: true, pendingVerification: true });
    } catch (error) {
      console.error("[Auth] Sign up failed", error);
      res.status(500).json({ error: "Sign up failed" });
    }
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    try {
      const database = await getDb();
      if (!database) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }
      const user = await UserService.getUserByEmail(database, email.toLowerCase().trim());
      if (user?.passwordHash) {
        const token = await AuthService.createPasswordResetToken(database, user.id);
        await sendResetEmail(email.toLowerCase().trim(), token, req);
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] Forgot password failed", error);
      res.status(500).json({ error: "Could not start password reset" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password || password.length < 8) {
      res.status(400).json({ error: "Valid token and password are required" });
      return;
    }
    try {
      const database = await getDb();
      if (!database) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }
      const row = await AuthService.consumePasswordResetToken(database, token);
      if (!row) {
        res.status(400).json({ error: "Reset link is invalid or expired" });
        return;
      }
      await UserService.setUserPasswordHash(database, row.userId, await hashPassword(password));
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] Reset password failed", error);
      res.status(500).json({ error: "Password reset failed" });
    }
  });

  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    try {
      const database = await getDb();
      if (!database) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }
      const user = await UserService.getUserByEmail(database, email.toLowerCase().trim());
      if (user && !user.emailVerifiedAt) {
        const token = await AuthService.createEmailVerificationToken(database, user.id, user.email || email);
        await sendVerificationEmail(user.email || email, token, req);
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] Resend verification failed", error);
      res.status(500).json({ error: "Could not resend verification" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ ok: true });
  });

  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/login");
  });
}

function loginPageHtml(state: { mode: string; token: string; status: string; type: string; error: string }): string {
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || "";
  const initialTab = state.type === "referral" ? "signup" : state.mode;
  const initialAccountType = state.type === "referral" ? "referral" : "business";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign In - Rebooked</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  ${turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ""}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #060a13;
      color: #e2e8f0;
      min-height: 100vh;
      min-height: 100dvh;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      -webkit-font-smoothing: antialiased;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(56, 96, 207, 0.12) 0%, transparent 70%),
        radial-gradient(ellipse 60% 50% at 80% 100%, rgba(99, 60, 200, 0.08) 0%, transparent 60%);
      pointer-events: none;
      z-index: 0;
    }

    .brand {
      text-align: center;
      margin-bottom: 32px;
      position: relative;
      z-index: 1;
    }
    .brand h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 32px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .brand p {
      color: #64748b;
      font-size: 14px;
      margin: 6px 0 0;
    }

    .card {
      width: 100%;
      max-width: 420px;
      background: rgba(15, 20, 35, 0.85);
      border: 1px solid rgba(99, 115, 155, 0.15);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
      backdrop-filter: blur(20px);
      position: relative;
      z-index: 1;
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 24px;
      background: rgba(15, 23, 42, 0.6);
      border-radius: 10px;
      padding: 4px;
      border: 1px solid rgba(99, 115, 155, 0.1);
    }
    .tab-btn {
      flex: 1;
      border: none;
      background: transparent;
      color: #64748b;
      border-radius: 8px;
      padding: 10px 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    .tab-btn:hover { color: #94a3b8; }
    .tab-btn.active {
      background: rgba(56, 96, 207, 0.15);
      color: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    /* Panels */
    .panel { display: none; }
    .panel.active { display: block; animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

    /* Form fields */
    .field { margin-bottom: 16px; }
    .field label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-wrap input {
      width: 100%;
      padding: 11px 14px;
      border-radius: 10px;
      border: 1px solid rgba(99, 115, 155, 0.2);
      background: rgba(15, 23, 42, 0.5);
      color: #e2e8f0;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }
    .input-wrap input::placeholder { color: #475569; }
    .input-wrap input:focus {
      border-color: rgba(56, 96, 207, 0.5);
      box-shadow: 0 0 0 3px rgba(56, 96, 207, 0.1);
    }
    .input-wrap .toggle-pw {
      position: absolute;
      right: 10px;
      background: none;
      border: none;
      color: #475569;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      transition: color 0.15s;
    }
    .input-wrap .toggle-pw:hover { color: #94a3b8; }

    /* Password requirements */
    .pw-reqs {
      display: flex;
      gap: 12px;
      margin: -8px 0 16px;
      font-size: 11px;
      color: #475569;
    }
    .pw-reqs span { display: flex; align-items: center; gap: 4px; }
    .pw-reqs .met { color: #34d399; }

    /* Account type toggle */
    .type-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }
    .type-btn {
      position: relative;
      border: 1px solid rgba(99, 115, 155, 0.15);
      background: rgba(15, 23, 42, 0.4);
      color: #64748b;
      border-radius: 10px;
      padding: 12px 14px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      text-align: left;
    }
    .type-btn:hover { border-color: rgba(99, 115, 155, 0.3); color: #94a3b8; }
    .type-btn.active {
      border-color: rgba(56, 96, 207, 0.4);
      background: rgba(56, 96, 207, 0.08);
      color: #e2e8f0;
    }
    .type-btn .type-label {
      font-size: 13px;
      font-weight: 600;
      display: block;
      margin-bottom: 2px;
    }
    .type-btn .type-desc {
      font-size: 11px;
      opacity: 0.7;
      line-height: 1.3;
    }
    .type-btn .type-check {
      position: absolute;
      top: 8px;
      right: 10px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid rgba(99, 115, 155, 0.25);
      transition: all 0.2s;
    }
    .type-btn.active .type-check {
      border-color: #3b6de0;
      background: #3b6de0;
      box-shadow: inset 0 0 0 3px rgba(15, 23, 42, 0.8);
    }

    /* Buttons */
    .btn-primary {
      width: 100%;
      border: none;
      border-radius: 10px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #3b6de0 0%, #2f5cc5 100%);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 4px;
    }
    .btn-primary:hover { background: linear-gradient(135deg, #4a7af0 0%, #3b6de0 100%); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(59, 109, 224, 0.25); }
    .btn-primary:active { transform: translateY(0); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
    .btn-primary .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: none;
    }
    .btn-primary.loading .spinner { display: block; }
    .btn-primary.loading .btn-text { display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn-link {
      background: none;
      border: none;
      color: #6b8acd;
      font-size: 13px;
      cursor: pointer;
      padding: 0;
      font-family: inherit;
      transition: color 0.15s;
    }
    .btn-link:hover { color: #93b4f5; text-decoration: underline; }

    /* Alerts */
    .alert {
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 20px;
      font-size: 13px;
      line-height: 1.5;
      display: none;
      align-items: flex-start;
      gap: 10px;
    }
    .alert.visible { display: flex; animation: fadeIn 0.25s ease; }
    .alert-icon { flex-shrink: 0; margin-top: 1px; }
    .alert-success {
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.2);
      color: #86efac;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #fca5a5;
    }

    /* Footer */
    .card-footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid rgba(99, 115, 155, 0.1);
      text-align: center;
    }
    .card-footer p {
      color: #475569;
      font-size: 12px;
      margin: 0;
      line-height: 1.5;
    }

    /* Divider with text */
    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0;
      font-size: 12px;
      color: #475569;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(99, 115, 155, 0.15);
    }

    /* Honeypot */
    .hp { position: absolute; left: -9999px; opacity: 0; height: 0; width: 0; }

    /* Responsive */
    @media (max-width: 480px) {
      body { padding: 16px; }
      .card { padding: 24px 20px; border-radius: 14px; }
      .brand h1 { font-size: 28px; }
      .type-btn .type-desc { display: none; }
    }
  </style>
</head>
<body>
  <div class="brand">
    <a href="/" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:10px;justify-content:center">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width="40" height="40"><rect x="8" y="16" width="48" height="40" rx="8" ry="8" stroke="#00A896" stroke-width="4" fill="none"/><line x1="22" y1="8" x2="22" y2="22" stroke="#00A896" stroke-width="4" stroke-linecap="round"/><line x1="42" y1="8" x2="42" y2="22" stroke="#00A896" stroke-width="4" stroke-linecap="round"/><path d="M40 34 C40 28, 28 28, 28 34 C28 40, 40 40, 40 34" stroke="#00A896" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M36 28 L40 34 L34 34" stroke="#00A896" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="50" cy="50" r="4" fill="#E8920A"/></svg>
      <h1>Rebooked</h1>
    </a>
    <p>Revenue recovery for appointment-based businesses</p>
    <a href="/" style="font-size:13px;color:#94a3b8;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:6px">&larr; Back to Home</a>
  </div>

  <div class="card">
    <div id="alert-success" class="alert alert-success">
      <span class="alert-icon"><svg width="16" height="16" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="#22c55e" stroke-width="1.5"/><path d="M5.5 8.5L7 10l3.5-4" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span id="alert-success-text"></span>
    </div>
    <div id="alert-error" class="alert alert-error">
      <span class="alert-icon"><svg width="16" height="16" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="#ef4444" stroke-width="1.5"/><path d="M8 5v3.5M8 10.5h.005" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/></svg></span>
      <span id="alert-error-text"></span>
    </div>

    <div class="tabs" role="tablist">
      <button class="tab-btn" data-tab="signin" onclick="switchTab('signin')" role="tab">Sign In</button>
      <button class="tab-btn" data-tab="signup" onclick="switchTab('signup')" role="tab">Sign Up</button>
      <button class="tab-btn" data-tab="forgot" onclick="switchTab('forgot')" role="tab">Forgot</button>
      <button class="tab-btn" data-tab="reset" onclick="switchTab('reset')" role="tab" style="${state.token ? '' : 'display:none'}">Reset</button>
    </div>

    <!-- Sign In Panel -->
    <div id="signin" class="panel" role="tabpanel">
      <form onsubmit="signIn(event)" novalidate>
        <div class="field">
          <label for="signin-email">Email address</label>
          <div class="input-wrap">
            <input id="signin-email" type="email" placeholder="you@example.com" autocomplete="email" required />
          </div>
        </div>
        <div class="field">
          <label for="signin-password">Password</label>
          <div class="input-wrap">
            <input id="signin-password" type="password" placeholder="Enter your password" autocomplete="current-password" required />
            <button type="button" class="toggle-pw" onclick="togglePassword('signin-password', this)" aria-label="Show password">
              <svg class="eye-open" width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/></svg>
              <svg class="eye-closed" width="18" height="18" fill="none" viewBox="0 0 24 24" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <button type="submit" id="signin-btn" class="btn-primary">
          <span class="spinner"></span>
          <span class="btn-text">Sign In</span>
        </button>
      </form>
      <div class="divider">or</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <button class="btn-link" onclick="switchTab('forgot')">Forgot your password?</button>
        <button class="btn-link" onclick="switchTab('signup')">Create account</button>
      </div>
    </div>

    <!-- Sign Up Panel -->
    <div id="signup" class="panel" role="tabpanel">
      <form onsubmit="signUp(event)" novalidate>
        <div class="type-toggle">
          <button type="button" id="type-business" class="type-btn active" onclick="setAccountType('business')">
            <span class="type-check"></span>
            <span class="type-label">Business</span>
            <span class="type-desc">Automations, analytics, revenue recovery</span>
          </button>
          <button type="button" id="type-referral" class="type-btn" onclick="setAccountType('referral')">
            <span class="type-check"></span>
            <span class="type-label">Referral</span>
            <span class="type-desc">Earn $300 per referral, track &amp; get paid</span>
          </button>
        </div>
        <input id="signup-account-type" type="hidden" value="${initialAccountType}" />
        <div class="field">
          <label for="signup-name">Your name</label>
          <div class="input-wrap">
            <input id="signup-name" type="text" placeholder="Jane Smith" autocomplete="name" />
          </div>
        </div>
        <div class="field">
          <label for="signup-email">Email address</label>
          <div class="input-wrap">
            <input id="signup-email" type="email" placeholder="you@example.com" autocomplete="email" required />
          </div>
        </div>
        <div class="field">
          <label for="signup-password">Password</label>
          <div class="input-wrap">
            <input id="signup-password" type="password" placeholder="Create a strong password" autocomplete="new-password" required oninput="checkPasswordStrength(this.value)" />
            <button type="button" class="toggle-pw" onclick="togglePassword('signup-password', this)" aria-label="Show password">
              <svg class="eye-open" width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/></svg>
              <svg class="eye-closed" width="18" height="18" fill="none" viewBox="0 0 24 24" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="pw-reqs">
            <span id="pw-length">8+ characters</span>
          </div>
        </div>
        <input id="signup-website" type="text" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
        ${turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${turnstileSiteKey}" style="margin-bottom:16px;"></div>` : ""}
        <button type="submit" id="signup-btn" class="btn-primary">
          <span class="spinner"></span>
          <span class="btn-text">Create Account</span>
        </button>
      </form>
      <div class="divider">already have an account?</div>
      <div style="display:flex;justify-content:center;gap:16px;">
        <button class="btn-link" onclick="switchTab('signin')">Sign in instead</button>
        <button class="btn-link" onclick="resendVerification()" title="Re-send if you signed up but didn't verify">Resend verification</button>
      </div>
    </div>

    <!-- Forgot Password Panel -->
    <div id="forgot" class="panel" role="tabpanel">
      <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;line-height:1.5;">Enter the email you signed up with. We'll send a reset link if the account exists.</p>
      <form onsubmit="forgotPassword(event)" novalidate>
        <div class="field">
          <label for="forgot-email">Email address</label>
          <div class="input-wrap">
            <input id="forgot-email" type="email" placeholder="you@example.com" autocomplete="email" required />
          </div>
        </div>
        <button type="submit" id="forgot-btn" class="btn-primary">
          <span class="spinner"></span>
          <span class="btn-text">Send Reset Link</span>
        </button>
      </form>
      <div class="divider">or</div>
      <button class="btn-link" onclick="switchTab('signin')" style="display:block;margin:0 auto;">Back to sign in</button>
    </div>

    <!-- Reset Password Panel -->
    <div id="reset" class="panel" role="tabpanel">
      <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;line-height:1.5;">The reset token was pre-filled from your email link. Choose a new password below.</p>
      <form onsubmit="resetPassword(event)" novalidate>
        <div class="field">
          <label for="reset-token">Reset token</label>
          <div class="input-wrap">
            <input id="reset-token" type="text" placeholder="Paste the token from your email" value="${state.token}" readonly style="${state.token ? 'opacity:0.6;' : ''}" />
          </div>
        </div>
        <div class="field">
          <label for="reset-password">New password</label>
          <div class="input-wrap">
            <input id="reset-password" type="password" placeholder="At least 8 characters" autocomplete="new-password" required />
            <button type="button" class="toggle-pw" onclick="togglePassword('reset-password', this)" aria-label="Show password">
              <svg class="eye-open" width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/></svg>
              <svg class="eye-closed" width="18" height="18" fill="none" viewBox="0 0 24 24" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <button type="submit" id="reset-btn" class="btn-primary">
          <span class="spinner"></span>
          <span class="btn-text">Save New Password</span>
        </button>
      </form>
      <div class="divider">or</div>
      <button class="btn-link" onclick="switchTab('signin')" style="display:block;margin:0 auto;">Back to sign in</button>
    </div>

    <div class="card-footer">
      <p>Email verification is required before your first sign in.</p>
    </div>
  </div>

  <script>
    /* ── State ── */
    const initialTab = ${JSON.stringify(initialTab)};
    const initialStatus = ${JSON.stringify(state.status)};
    const initialError = ${JSON.stringify(state.error)};
    const initialAccountType = ${JSON.stringify(initialAccountType)};

    /* ── Alerts ── */
    function showSuccess(msg) {
      const el = document.getElementById('alert-success');
      document.getElementById('alert-success-text').textContent = msg;
      el.classList.add('visible');
      document.getElementById('alert-error').classList.remove('visible');
    }
    function showError(msg) {
      const el = document.getElementById('alert-error');
      document.getElementById('alert-error-text').textContent = msg;
      el.classList.add('visible');
      document.getElementById('alert-success').classList.remove('visible');
    }
    function clearAlerts() {
      document.getElementById('alert-success').classList.remove('visible');
      document.getElementById('alert-error').classList.remove('visible');
    }

    /* ── Tabs ── */
    function switchTab(tab) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === tab));
      clearAlerts();
      // Auto-focus the first input in the active panel
      requestAnimationFrame(() => {
        const firstInput = document.querySelector('#' + tab + ' input:not([type=hidden]):not(.hp)');
        if (firstInput && !firstInput.readOnly) firstInput.focus();
      });
    }

    /* ── Password visibility ── */
    function togglePassword(inputId, btn) {
      const input = document.getElementById(inputId);
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.querySelector('.eye-open').style.display = isPassword ? 'none' : 'block';
      btn.querySelector('.eye-closed').style.display = isPassword ? 'block' : 'none';
    }

    /* ── Password strength ── */
    function checkPasswordStrength(value) {
      const lenEl = document.getElementById('pw-length');
      if (value.length >= 8) { lenEl.classList.add('met'); lenEl.textContent = '8+ characters'; }
      else { lenEl.classList.remove('met'); lenEl.textContent = '8+ characters'; }
    }

    /* ── Networking ── */
    async function postJson(url, payload) {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    function setLoading(btnId, loading) {
      const btn = document.getElementById(btnId);
      btn.disabled = loading;
      btn.classList.toggle('loading', loading);
    }

    function turnstileToken() {
      if (!window.turnstile) return '';
      const input = document.querySelector('[name="cf-turnstile-response"]');
      return input ? input.value : '';
    }

    /* ── Account type ── */
    function setAccountType(type) {
      document.getElementById('signup-account-type').value = type;
      document.getElementById('type-business').classList.toggle('active', type === 'business');
      document.getElementById('type-referral').classList.toggle('active', type === 'referral');
    }

    /* ── Sign In ── */
    async function signIn(e) {
      e && e.preventDefault();
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;
      if (!email) { showError('Please enter your email address.'); return; }
      if (!password) { showError('Please enter your password.'); return; }
      setLoading('signin-btn', true);
      try {
        const data = await postJson('/api/auth/signin', { email, password });
        showSuccess('Signing you in...');
        // Check for stored redirect path from AuthGuard
        const savedPath = sessionStorage.getItem('redirectPath');
        sessionStorage.removeItem('redirectPath');
        const defaultPath = data.accountType === 'admin' ? '/admin/tenants' : (data.accountType === 'referral' ? '/referral' : '/dashboard');
        window.location.href = savedPath && savedPath !== '/login' ? savedPath : defaultPath;
      } catch (error) {
        showError(error.message || String(error));
        setLoading('signin-btn', false);
      }
    }

    /* ── Sign Up ── */
    async function signUp(e) {
      e && e.preventDefault();
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const accountType = document.getElementById('signup-account-type').value;
      if (!email) { showError('Please enter your email address.'); return; }
      if (!password) { showError('Please enter a password.'); return; }
      if (password.length < 8) { showError('Password must be at least 8 characters long.'); return; }
      setLoading('signup-btn', true);
      try {
        const result = await postJson('/api/auth/signup', {
          name, email, password,
          website: document.getElementById('signup-website').value,
          captchaToken: turnstileToken(),
          accountType,
        });
        if (result.upgraded) {
          showSuccess(result.message || 'Your account now has both business and referral capabilities. Sign in to continue.');
        } else {
          showSuccess('Account created! Check your email for a verification link, then sign in.');
        }
        switchTab('signin');
        document.getElementById('signin-email').value = email;
      } catch (error) {
        showError(error.message || String(error));
      } finally {
        setLoading('signup-btn', false);
      }
    }

    /* ── Forgot ── */
    async function forgotPassword(e) {
      e && e.preventDefault();
      const email = document.getElementById('forgot-email').value.trim();
      if (!email) { showError('Please enter your email address.'); return; }
      setLoading('forgot-btn', true);
      try {
        await postJson('/api/auth/forgot-password', { email });
        showSuccess('If that email exists, we sent a password reset link. Check your inbox.');
        // Show the reset tab now
        const resetTab = document.querySelector('[data-tab="reset"]');
        if (resetTab) resetTab.style.display = '';
        switchTab('reset');
      } catch (error) {
        showError(error.message || String(error));
      } finally {
        setLoading('forgot-btn', false);
      }
    }

    /* ── Reset ── */
    async function resetPassword(e) {
      e && e.preventDefault();
      const token = document.getElementById('reset-token').value.trim();
      const password = document.getElementById('reset-password').value;
      if (!token) { showError('Please paste the reset token from your email.'); return; }
      if (!password || password.length < 8) { showError('New password must be at least 8 characters.'); return; }
      setLoading('reset-btn', true);
      try {
        await postJson('/api/auth/reset-password', { token, password });
        showSuccess('Password reset successfully. You can sign in with your new password.');
        switchTab('signin');
      } catch (error) {
        showError(error.message || String(error));
      } finally {
        setLoading('reset-btn', false);
      }
    }

    /* ── Resend verification ── */
    async function resendVerification() {
      const email = document.getElementById('signup-email').value.trim() || document.getElementById('signin-email').value.trim();
      if (!email) { showError('Enter an email address first, then click resend.'); return; }
      try {
        await postJson('/api/auth/resend-verification', { email });
        showSuccess('If the account is pending verification, we sent a new email.');
      } catch (error) {
        showError(error.message || String(error));
      }
    }

    /* ── Allow Enter key to submit forms ── */
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      const active = document.querySelector('.panel.active');
      if (!active) return;
      const form = active.querySelector('form');
      if (form) form.requestSubmit();
    });

    /* ── Init ── */
    if (initialStatus === 'verify-success') showSuccess('Email verified successfully! You can now sign in.');
    else if (initialStatus === 'verify-invalid') showError('That verification link is invalid or has expired. Please request a new one.');
    else if (initialStatus === 'verify-missing') showError('Verification link is missing a token. Please check your email again.');
    else if (initialStatus === 'verify-error') showError('We could not verify your email right now. Please try again later.');
    if (initialError) showError(decodeURIComponent(initialError));

    // Set initial account type for referral links
    if (initialAccountType === 'referral') setAccountType('referral');

    switchTab(initialTab);
  </script>
</body>
</html>`;
}
