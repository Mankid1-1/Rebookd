import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { createHash, randomBytes } from "crypto";

// ─── Simple built-in auth — no external OAuth server needed ──────────────────
// Uses email + password stored in the DB. Passwords are SHA-256 hashed.
// Session tokens are the same JWT format used everywhere else in the app.

function hashPassword(password: string): string {
  return createHash("sha256")
    .update(password + (ENV.cookieSecret || "rebookd-salt"))
    .digest("hex");
}

function generateOpenId(): string {
  return "local_" + randomBytes(16).toString("hex");
}

export function registerOAuthRoutes(app: Express) {
  // ── Serve the login page ───────────────────────────────────────────────────
  app.get("/login", (_req: Request, res: Response) => {
    res.send(loginPageHtml());
  });

  // ── Sign in ────────────────────────────────────────────────────────────────
  app.post("/api/auth/signin", async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    try {
      const user = await db.getUserByEmail(email.toLowerCase().trim());

      if (!user || user.loginMethod !== "local") {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const storedHash = user.passwordHash;
      if (!storedHash || storedHash !== hashPassword(password)) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] Sign in failed", error);
      res.status(500).json({ error: "Sign in failed" });
    }
  });

  // ── Sign up ────────────────────────────────────────────────────────────────
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    try {
      const existing = await db.getUserByEmail(email.toLowerCase().trim());
      if (existing) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }

      const openId = generateOpenId();
      const passwordHash = hashPassword(password);

      await db.upsertUser({
        openId,
        name: name?.trim() || email.split("@")[0],
        email: email.toLowerCase().trim(),
        loginMethod: "local",
        lastSignedIn: new Date(),
        // Store hash in the name field temporarily — see db.ts note
      });

      // Store the password hash
      await db.setUserPasswordHash(openId, passwordHash);

      const user = await db.getUserByOpenId(openId);
      if (!user) throw new Error("User creation failed");

      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] Sign up failed", error);
      res.status(500).json({ error: "Sign up failed" });
    }
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ ok: true });
  });

  // ── Legacy OAuth callback — redirect to login page ─────────────────────────
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/login");
  });
}

// ─── Login page HTML (self-contained, no React needed) ───────────────────────

function loginPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rebookd — Sign In</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #0d0f14;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: #161b27;
      border: 1px solid #1e2d40;
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 420px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: center;
      margin-bottom: 2rem;
    }
    .logo-icon {
      width: 36px; height: 36px;
      background: #3b82f6;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .logo-icon svg { width: 18px; height: 18px; fill: white; }
    .logo-text { font-family: 'Space Grotesk', sans-serif; font-size: 1.25rem; font-weight: 700; }
    .tabs {
      display: flex;
      background: #0d0f14;
      border-radius: 10px;
      padding: 4px;
      margin-bottom: 1.5rem;
    }
    .tab {
      flex: 1; padding: 8px; border: none; background: transparent;
      color: #64748b; font-size: 14px; font-weight: 500; border-radius: 8px;
      cursor: pointer; transition: all 0.15s;
    }
    .tab.active { background: #1e2d40; color: #e2e8f0; }
    .field { margin-bottom: 1rem; }
    label { display: block; font-size: 13px; font-weight: 500; color: #94a3b8; margin-bottom: 6px; }
    input {
      width: 100%; padding: 10px 14px;
      background: #0d0f14; border: 1px solid #1e2d40;
      border-radius: 8px; color: #e2e8f0; font-size: 14px;
      outline: none; transition: border-color 0.15s;
    }
    input:focus { border-color: #3b82f6; }
    .btn {
      width: 100%; padding: 11px;
      background: #3b82f6; color: white;
      border: none; border-radius: 8px;
      font-size: 14px; font-weight: 600;
      cursor: pointer; margin-top: 0.5rem;
      transition: background 0.15s;
    }
    .btn:hover { background: #2563eb; }
    .btn:disabled { background: #1e3a5f; color: #64748b; cursor: not-allowed; }
    .error {
      background: #2d1515; border: 1px solid #7f1d1d;
      color: #fca5a5; border-radius: 8px;
      padding: 10px 14px; font-size: 13px;
      margin-bottom: 1rem; display: none;
    }
    .form { display: none; }
    .form.active { display: block; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      </div>
      <span class="logo-text">Rebookd</span>
    </div>

    <div class="tabs">
      <button class="tab active" onclick="switchTab('signin')">Sign in</button>
      <button class="tab" onclick="switchTab('signup')">Create account</button>
    </div>

    <div id="error" class="error"></div>

    <!-- Sign In -->
    <div id="signin-form" class="form active">
      <div class="field">
        <label>Email</label>
        <input type="email" id="signin-email" placeholder="you@example.com" />
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" id="signin-password" placeholder="••••••••" onkeydown="if(event.key==='Enter')doSignIn()" />
      </div>
      <button class="btn" id="signin-btn" onclick="doSignIn()">Sign in</button>
      <p style="text-align:center;margin-top:12px;font-size:12px;color:#475569;">
        Forgot your password? Contact your administrator.
      </p>
    </div>

    <!-- Sign Up -->
    <div id="signup-form" class="form">
      <div class="field">
        <label>Your name</label>
        <input type="text" id="signup-name" placeholder="Jane Smith" />
      </div>
      <div class="field">
        <label>Email</label>
        <input type="email" id="signup-email" placeholder="you@example.com" />
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" id="signup-password" placeholder="At least 8 characters" onkeydown="if(event.key==='Enter')doSignUp()" />
      </div>
      <button class="btn" id="signup-btn" onclick="doSignUp()">Create account</button>
    </div>
  </div>

  <script>
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', (i === 0) === (tab === 'signin')));
      document.getElementById('signin-form').classList.toggle('active', tab === 'signin');
      document.getElementById('signup-form').classList.toggle('active', tab === 'signup');
      document.getElementById('error').style.display = 'none';
    }

    function showError(msg) {
      const el = document.getElementById('error');
      el.textContent = msg;
      el.style.display = 'block';
    }

    async function doSignIn() {
      const btn = document.getElementById('signin-btn');
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;
      if (!email || !password) return showError('Please enter your email and password.');
      btn.disabled = true; btn.textContent = 'Signing in...';
      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        let data;
        try { data = await res.json(); } catch(e) { data = {}; }
        if (!res.ok) {
          showError(data.error || 'Sign in failed (status ' + res.status + ')');
          btn.disabled = false; btn.textContent = 'Sign in'; return;
        }
        window.location.href = '/dashboard';
      } catch(e) {
        showError('Network error: ' + e.message);
        btn.disabled = false; btn.textContent = 'Sign in';
      }
    }

    async function doSignUp() {
      const btn = document.getElementById('signup-btn');
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      if (!email || !password) return showError('Please enter your email and password.');
      if (password.length < 8) return showError('Password must be at least 8 characters.');
      btn.disabled = true; btn.textContent = 'Creating account...';
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error || 'Sign up failed.'); btn.disabled = false; btn.textContent = 'Create account'; return; }
        window.location.href = '/onboarding';
      } catch { showError('Network error. Is the server running?'); btn.disabled = false; btn.textContent = 'Create account'; }
    }
  </script>
</body>
</html>`;
}
