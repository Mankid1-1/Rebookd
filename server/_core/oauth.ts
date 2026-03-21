import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { getDb } from "../db";
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
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(password, storedHash);
  }
  return storedHash === legacyHashPassword(password);
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
  if (!secret) return process.env.NODE_ENV !== "production";
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
  return { mode, token, status };
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
      if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      if (!user.emailVerifiedAt) {
        const token = await AuthService.createEmailVerificationToken(database, user.id, user.email || email);
        await sendVerificationEmail(user.email || email, token, req);
        res.status(403).json({ error: "Verify your email before signing in. We sent a fresh link." });
        return;
      }

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      await UserService.updateLastSignedIn(database, user.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] Sign in failed", error);
      res.status(500).json({ error: "Sign in failed" });
    }
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const { email, password, name, website, captchaToken } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      website?: string;
      captchaToken?: string;
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
      const existing = await UserService.getUserByEmail(database, normalizedEmail);
      if (existing?.emailVerifiedAt) {
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

function loginPageHtml(state: { mode: string; token: string; status: string }): string {
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rebooked Sign In</title>
  ${turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ""}
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #0b1020; color: #e5ecf5; min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; }
    .card { width: 100%; max-width: 460px; background: #121a2e; border: 1px solid #233150; border-radius: 20px; padding: 28px; box-shadow: 0 18px 60px rgba(0,0,0,.35); }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { color: #9db0cd; line-height: 1.5; }
    .tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 20px 0; }
    .tab { border: 1px solid #233150; background: #0d1425; color: #9db0cd; border-radius: 12px; padding: 10px; cursor: pointer; }
    .tab.active { background: #1b2a49; color: #fff; border-color: #4d73c9; }
    .panel { display: none; }
    .panel.active { display: block; }
    label { display: block; margin: 0 0 6px; font-size: 13px; color: #b7c7df; }
    input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #233150; background: #0d1425; color: #fff; margin-bottom: 14px; }
    button.primary { width: 100%; border: 0; border-radius: 12px; padding: 12px 14px; background: #4d73c9; color: white; font-weight: 700; cursor: pointer; }
    button.secondary { width: 100%; border: 1px solid #35518d; border-radius: 12px; padding: 12px 14px; background: transparent; color: #d4e0f2; cursor: pointer; margin-top: 10px; }
    .notice, .error { border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: none; }
    .notice { background: rgba(41, 177, 107, .14); border: 1px solid rgba(41, 177, 107, .35); color: #baf3d0; }
    .error { background: rgba(213, 84, 84, .14); border: 1px solid rgba(213, 84, 84, .35); color: #ffd1d1; }
    .linkish { color: #88a9ff; cursor: pointer; text-decoration: underline; }
    .footer { margin-top: 14px; font-size: 13px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Rebooked</h1>
    <p>Sign in, create an account, or recover access without leaving this page.</p>
    <div id="notice" class="notice"></div>
    <div id="error" class="error"></div>
    <div class="tabs">
      <button class="tab" data-tab="signin" onclick="switchTab('signin')">Sign in</button>
      <button class="tab" data-tab="signup" onclick="switchTab('signup')">Sign up</button>
      <button class="tab" data-tab="forgot" onclick="switchTab('forgot')">Forgot</button>
      <button class="tab" data-tab="reset" onclick="switchTab('reset')">Reset</button>
    </div>

    <div id="signin" class="panel">
      <label>Email</label>
      <input id="signin-email" type="email" placeholder="you@example.com" />
      <label>Password</label>
      <input id="signin-password" type="password" placeholder="Your password" />
      <button id="signin-btn" class="primary" onclick="signIn()">Sign in</button>
      <button class="secondary" onclick="switchTab('forgot')">Forgot password</button>
    </div>

    <div id="signup" class="panel">
      <label>Name</label>
      <input id="signup-name" type="text" placeholder="Jane Smith" />
      <label>Email</label>
      <input id="signup-email" type="email" placeholder="you@example.com" />
      <label>Password</label>
      <input id="signup-password" type="password" placeholder="At least 8 characters" />
      <input id="signup-website" class="hidden" type="text" tabindex="-1" autocomplete="off" />
      ${turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${turnstileSiteKey}"></div>` : `<p style="margin:-4px 0 14px;font-size:13px;">Signup protection is using server-side honeypot mode because Turnstile keys are not configured.</p>`}
      <button id="signup-btn" class="primary" onclick="signUp()">Create account</button>
      <button class="secondary" onclick="resendVerification()">Resend verification email</button>
    </div>

    <div id="forgot" class="panel">
      <label>Email</label>
      <input id="forgot-email" type="email" placeholder="you@example.com" />
      <button id="forgot-btn" class="primary" onclick="forgotPassword()">Send reset link</button>
    </div>

    <div id="reset" class="panel">
      <label>Reset token</label>
      <input id="reset-token" type="text" placeholder="Paste the reset token from your email link" value="${state.token}" />
      <label>New password</label>
      <input id="reset-password" type="password" placeholder="At least 8 characters" />
      <button id="reset-btn" class="primary" onclick="resetPassword()">Save new password</button>
    </div>

    <p class="footer">Verification is required before first sign in. Billing invoices and automations stay tied to the verified account.</p>
  </div>
  <script>
    const initialMode = ${JSON.stringify(state.mode)};
    const initialStatus = ${JSON.stringify(state.status)};

    function notice(message) {
      const el = document.getElementById('notice');
      el.textContent = message;
      el.style.display = 'block';
      document.getElementById('error').style.display = 'none';
    }

    function fail(message) {
      const el = document.getElementById('error');
      el.textContent = message;
      el.style.display = 'block';
      document.getElementById('notice').style.display = 'none';
    }

    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === tab));
      document.getElementById('error').style.display = 'none';
    }

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

    function turnstileToken() {
      if (!window.turnstile) return '';
      const input = document.querySelector('[name="cf-turnstile-response"]');
      return input ? input.value : '';
    }

    async function signIn() {
      try {
        await postJson('/api/auth/signin', {
          email: document.getElementById('signin-email').value.trim(),
          password: document.getElementById('signin-password').value,
        });
        window.location.href = '/dashboard';
      } catch (error) {
        fail(error.message || String(error));
      }
    }

    async function signUp() {
      try {
        await postJson('/api/auth/signup', {
          name: document.getElementById('signup-name').value.trim(),
          email: document.getElementById('signup-email').value.trim(),
          password: document.getElementById('signup-password').value,
          website: document.getElementById('signup-website').value,
          captchaToken: turnstileToken(),
        });
        notice('Account created. Check your email for the verification link before signing in.');
        switchTab('signin');
      } catch (error) {
        fail(error.message || String(error));
      }
    }

    async function forgotPassword() {
      try {
        await postJson('/api/auth/forgot-password', {
          email: document.getElementById('forgot-email').value.trim(),
        });
        notice('If that email exists, we sent a password reset link.');
        switchTab('reset');
      } catch (error) {
        fail(error.message || String(error));
      }
    }

    async function resetPassword() {
      try {
        await postJson('/api/auth/reset-password', {
          token: document.getElementById('reset-token').value.trim(),
          password: document.getElementById('reset-password').value,
        });
        notice('Password reset complete. You can sign in now.');
        switchTab('signin');
      } catch (error) {
        fail(error.message || String(error));
      }
    }

    async function resendVerification() {
      try {
        await postJson('/api/auth/resend-verification', {
          email: document.getElementById('signup-email').value.trim(),
        });
        notice('If the account is waiting on verification, we sent a new email.');
      } catch (error) {
        fail(error.message || String(error));
      }
    }

    if (initialStatus === 'verify-success') notice('Email verified. You can sign in now.');
    if (initialStatus === 'verify-invalid') fail('That verification link is invalid or expired. Request a new one.');
    if (initialStatus === 'verify-missing') fail('Verification link is missing a token.');
    if (initialStatus === 'verify-error') fail('We could not verify your email right now.');
    switchTab(initialMode);
  </script>
</body>
</html>`;
}
