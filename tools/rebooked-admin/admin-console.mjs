#!/usr/bin/env node
/**
 * Rebooked Admin Console v2.0
 *
 * A standalone desktop administration tool that auto-connects to your
 * Rebooked deployment by reading credentials from the project's .env file.
 *
 * Features:
 *   - Auto-discovers project root and reads .env for SSH/API credentials
 *   - Monitors server health, memory, uptime, and worker status in real-time
 *   - Shows deployment history and live version info
 *   - Triggers zero-downtime deployments via SSH
 *   - Manages PM2 processes (reload, restart, logs)
 *   - Displays database stats (tenants, users, leads)
 *
 * Usage:
 *   pnpm admin:console                    (auto-connects using project .env)
 *   node admin-console.mjs                (auto-connects using project .env)
 *   node admin-console.mjs --host 1.2.3.4 (override host)
 *
 * Build .exe:
 *   pnpm admin:build-exe
 */

import http from "http";
import https from "https";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { Client } from "ssh2";

// Works in both ESM (node admin-console.mjs) and CJS (pkg .exe bundle)
const __pkg_dirname = typeof __dirname !== "undefined"
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));
const LOCAL_PORT = 4896;

// ── Parse CLI args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

// ── Auto-discover project .env ───────────────────────────────────────────────

function findProjectRoot() {
  // When running from tools/rebooked-admin/, project root is ../../
  const candidates = [
    resolve(__pkg_dirname, "../.."),        // Normal: tools/rebooked-admin → project root
    resolve(process.cwd()),                // CWD might be project root
    resolve(process.cwd(), "../.."),       // CWD might be in tools/rebooked-admin
  ];

  // For .exe: check next to the executable and up from there
  if (process.pkg) {
    const exeDir = dirname(process.execPath);
    candidates.unshift(exeDir);
    candidates.push(resolve(exeDir, ".."));
    candidates.push(resolve(exeDir, "../.."));
    candidates.push(resolve(exeDir, "../../.."));
  }

  for (const dir of candidates) {
    const hasEnv = existsSync(join(dir, ".env")) || existsSync(join(dir, ".env.production"));
    if (hasEnv && existsSync(join(dir, "package.json"))) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        if (pkg.name === "rebooked") return dir;
      } catch { /* skip */ }
    }
  }
  return null;
}

function parseEnvFile(filePath) {
  const vars = {};
  if (!existsSync(filePath)) return vars;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

// ── Load config (auto-connect) ───────────────────────────────────────────────

const projectRoot = findProjectRoot();
let envVars = {};
let configSource = "defaults";

if (projectRoot) {
  // Try .env first, then .env.production
  const envPath = join(projectRoot, ".env");
  const envProdPath = join(projectRoot, ".env.production");

  if (existsSync(envPath)) {
    envVars = parseEnvFile(envPath);
    configSource = envPath;
  } else if (existsSync(envProdPath)) {
    envVars = parseEnvFile(envProdPath);
    configSource = envProdPath;
  }
}

// Also check for a local config.json next to the exe (for packaged builds)
const localConfigPath = process.pkg
  ? join(dirname(process.execPath), "rebooked-admin-config.json")
  : join(__pkg_dirname, "rebooked-admin-config.json");

let localConfig = {};
if (existsSync(localConfigPath)) {
  try {
    localConfig = JSON.parse(readFileSync(localConfigPath, "utf8"));
    // Only override configSource if no .env was found
    if (configSource === "defaults") configSource = localConfigPath;
  } catch { /* skip */ }
}

// Helper: pick first non-empty value (skips empty strings and underscore-prefixed keys in JSON config)
function pick(...vals) { return vals.find(v => v != null && v !== "") || ""; }

// Priority: CLI args > .env file > local config > env vars > defaults
const TARGET_HOST = pick(getArg("host"), envVars.DEPLOY_SSH_HOST, localConfig.host, process.env.REBOOKED_HOST) || "173.249.56.141";
const TARGET_PORT = parseInt(pick(getArg("port"), process.env.REBOOKED_PORT, String(localConfig.port || "")) || "3000", 10);
const SSH_USER = pick(getArg("user"), envVars.DEPLOY_SSH_USER, localConfig.sshUser, process.env.REBOOKED_SSH_USER) || "root";
const SSH_PASSWORD = pick(getArg("password"), envVars.DEPLOY_SSH_PASSWORD, localConfig.sshPassword, process.env.REBOOKED_SSH_PASSWORD);
const SSH_KEY_PATH = pick(getArg("key"), envVars.DEPLOY_SSH_KEY_PATH, localConfig.sshKeyPath, process.env.REBOOKED_SSH_KEY);
const API_TOKEN = pick(getArg("token"), envVars.WEBHOOK_SECRET, localConfig.apiToken, process.env.REBOOKED_API_TOKEN);
const SSH_PORT = parseInt(pick(getArg("ssh-port"), envVars.DEPLOY_SSH_PORT, String(localConfig.sshPort || "")) || "22", 10);

const sshConfigured = !!(SSH_USER && (SSH_PASSWORD || SSH_KEY_PATH));

// ── SSH Helpers ──────────────────────────────────────────────────────────────

function sshExec(cmd, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (!sshConfigured) return reject(new Error("SSH not configured — check your .env file for DEPLOY_SSH_* variables"));
    const conn = new Client();
    const timer = setTimeout(() => { conn.end(); reject(new Error("SSH command timed out")); }, timeoutMs);

    conn.on("ready", () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); return reject(err); }
        let stdout = "", stderr = "";
        stream.on("data", (d) => (stdout += d));
        stream.stderr.on("data", (d) => (stderr += d));
        stream.on("close", (code) => { clearTimeout(timer); conn.end(); resolve({ stdout, stderr, code }); });
      });
    });
    conn.on("error", (err) => { clearTimeout(timer); reject(err); });

    const sshConfig = { host: TARGET_HOST, port: SSH_PORT, username: SSH_USER, readyTimeout: 10000 };
    if (SSH_KEY_PATH && existsSync(SSH_KEY_PATH)) {
      sshConfig.privateKey = readFileSync(SSH_KEY_PATH);
    } else if (SSH_PASSWORD) {
      sshConfig.password = SSH_PASSWORD;
    }
    conn.connect(sshConfig);
  });
}

// ── API proxy to Rebooked server ─────────────────────────────────────────────

async function proxyToServer(path) {
  return new Promise((resolve) => {
    const url = `http://${TARGET_HOST}:${TARGET_PORT}${path}`;
    const headers = {};
    if (API_TOKEN) headers["x-internal-token"] = API_TOKEN;

    http.get(url, { headers, timeout: 8000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ error: "Parse error", raw: data }); }
      });
    }).on("error", (err) => resolve({ error: err.message }));
  });
}

async function postToServer(path, body) {
  return new Promise((resolve) => {
    const url = new URL(`http://${TARGET_HOST}:${TARGET_PORT}${path}`);
    const postData = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      timeout: 8000,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        ...(API_TOKEN ? { "x-internal-token": API_TOKEN } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ error: "Parse error", raw: data }); }
      });
    });
    req.on("error", (err) => resolve({ error: err.message }));
    req.write(postData);
    req.end();
  });
}

// ── Dashboard HTML ───────────────────────────────────────────────────────────

function getDashboardHTML() {
  // Try loading from file (development), fall back to embedded (packaged .exe)
  const htmlPath = join(__pkg_dirname, "dashboard.html");
  if (existsSync(htmlPath)) return readFileSync(htmlPath, "utf8");
  return EMBEDDED_DASHBOARD;
}

// ── Local HTTP Server ────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${LOCAL_PORT}`);

  // CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // API endpoints
  if (url.pathname === "/api/status") {
    const data = await proxyToServer("/api/system/status");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === "/api/version") {
    const data = await proxyToServer("/api/version");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === "/api/health") {
    const data = await proxyToServer("/health");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === "/api/pm2" && sshConfigured) {
    try {
      const result = await sshExec("pm2 jlist 2>/dev/null || echo '[]'");
      const processes = JSON.parse(result.stdout || "[]");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(processes));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/pm2/reload" && sshConfigured && req.method === "POST") {
    try {
      const result = await sshExec("cd /opt/rebooked && pm2 reload rebooked-app 2>&1");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, output: result.stdout }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/pm2/restart-worker" && sshConfigured && req.method === "POST") {
    try {
      const result = await sshExec("cd /opt/rebooked && pm2 restart rebooked-worker 2>&1");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, output: result.stdout }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/logs" && sshConfigured) {
    const lines = url.searchParams.get("lines") || "50";
    try {
      const result = await sshExec(`pm2 logs rebooked-app --nostream --lines ${lines} 2>&1`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ logs: result.stdout }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/deploy" && sshConfigured && req.method === "POST") {
    try {
      // Trigger a full deploy from the VPS side
      const result = await sshExec("cd /opt/rebooked && pm2 reload rebooked-app --update-env 2>&1", 30000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, output: result.stdout }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/ssh/test") {
    if (!sshConfigured) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ connected: false, error: "SSH not configured" }));
      return;
    }
    try {
      const result = await sshExec("echo ok", 10000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ connected: result.code === 0, output: result.stdout.trim() }));
    } catch (err) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ connected: false, error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/config") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      host: TARGET_HOST,
      port: TARGET_PORT,
      sshConfigured,
      sshUser: SSH_USER || null,
      tokenConfigured: !!API_TOKEN,
      configSource,
      projectRoot: projectRoot || null,
    }));
    return;
  }

  if (url.pathname === "/api/config/save" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const config = JSON.parse(body);
        writeFileSync(localConfigPath, JSON.stringify(config, null, 2));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, savedTo: localConfigPath }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve dashboard
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDashboardHTML());
});

import { exec as execCb } from "child_process";

server.listen(LOCAL_PORT, () => {
  console.log("");
  console.log("  ╔════════════════════════════════════════╗");
  console.log("  ║     REBOOKED ADMIN CONSOLE v2.0        ║");
  console.log("  ╠════════════════════════════════════════╣");
  console.log(`  ║  Dashboard: http://localhost:${LOCAL_PORT}     ║`);
  console.log(`  ║  Target:    ${(TARGET_HOST + ":" + TARGET_PORT).padEnd(25)}║`);
  console.log(`  ║  SSH:       ${(sshConfigured ? "connected (" + SSH_USER + ")" : "not configured").padEnd(25)}║`);
  console.log(`  ║  Config:    ${(configSource === "defaults" ? "defaults (no .env found)" : "auto-detected").padEnd(25)}║`);
  console.log("  ╚════════════════════════════════════════╝");

  if (projectRoot) {
    console.log(`\n  Project: ${projectRoot}`);
    console.log(`  Config:  ${configSource}`);
  } else {
    console.log("\n  No project .env found — using defaults.");
    console.log("  Place rebooked-admin-config.json next to this exe, or run from the project root.");
  }

  if (!sshConfigured) {
    console.log("\n  SSH not configured — set DEPLOY_SSH_PASSWORD or DEPLOY_SSH_KEY_PATH in .env");
    console.log("  PM2 management and logs will be unavailable.\n");
  } else {
    console.log(`\n  SSH ready: ${SSH_USER}@${TARGET_HOST}:${SSH_PORT}`);
    console.log("");
  }

  // Auto-open browser
  const openCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  execCb(`${openCmd} http://localhost:${LOCAL_PORT}`);
});

// ── Embedded Dashboard (for .exe packaging) ──────────────────────────────────
const EMBEDDED_DASHBOARD = "<!-- fallback -->";
