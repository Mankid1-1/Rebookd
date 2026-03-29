#!/usr/bin/env node
/**
 * Rebooked Admin Console
 *
 * A standalone desktop administration tool that:
 *   - Monitors server health, memory, uptime, and worker status in real-time
 *   - Shows deployment history and live version info
 *   - Triggers zero-downtime deployments via SSH
 *   - Manages PM2 processes (reload, restart, logs)
 *   - Displays database stats (tenants, users, leads)
 *
 * Usage:
 *   node admin-console.mjs                     (interactive setup)
 *   node admin-console.mjs --host 1.2.3.4      (connect directly)
 *
 * Build .exe:
 *   npm run build:exe
 */

import http from "http";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Client } from "ssh2";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_PORT = 4896;

// ── Parse CLI args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

const TARGET_HOST = getArg("host") || process.env.REBOOKED_HOST || "173.249.56.141";
const TARGET_PORT = parseInt(getArg("port") || process.env.REBOOKED_PORT || "3000", 10);
const SSH_USER = getArg("user") || process.env.REBOOKED_SSH_USER || "";
const SSH_PASSWORD = getArg("password") || process.env.REBOOKED_SSH_PASSWORD || "";
const SSH_KEY_PATH = getArg("key") || process.env.REBOOKED_SSH_KEY || "";
const API_TOKEN = getArg("token") || process.env.REBOOKED_API_TOKEN || process.env.WEBHOOK_SECRET || "";

// ── SSH Helpers ──────────────────────────────────────────────────────────────

function sshExec(cmd) {
  return new Promise((resolve, reject) => {
    if (!SSH_USER) return reject(new Error("No SSH user configured"));
    const conn = new Client();
    conn.on("ready", () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        let stdout = "", stderr = "";
        stream.on("data", (d) => (stdout += d));
        stream.stderr.on("data", (d) => (stderr += d));
        stream.on("close", (code) => { conn.end(); resolve({ stdout, stderr, code }); });
      });
    });
    conn.on("error", reject);
    const sshConfig = { host: TARGET_HOST, port: 22, username: SSH_USER };
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

    http.get(url, { headers, timeout: 5000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ error: "Parse error", raw: data }); }
      });
    }).on("error", (err) => resolve({ error: err.message }));
  });
}

// ── Dashboard HTML ───────────────────────────────────────────────────────────

function getDashboardHTML() {
  // Try loading from file (development), fall back to embedded (packaged .exe)
  const htmlPath = join(__dirname, "dashboard.html");
  if (existsSync(htmlPath)) return readFileSync(htmlPath, "utf8");
  return EMBEDDED_DASHBOARD;
}

// ── Local HTTP Server ─────��──────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${LOCAL_PORT}`);

  // API endpoints
  if (url.pathname === "/api/status") {
    const data = await proxyToServer("/api/system/status");
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
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

  if (url.pathname === "/api/pm2" && SSH_USER) {
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

  if (url.pathname === "/api/pm2/reload" && SSH_USER && req.method === "POST") {
    try {
      const result = await sshExec("pm2 reload rebooked-app 2>&1");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, output: result.stdout }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/pm2/restart-worker" && SSH_USER && req.method === "POST") {
    try {
      const result = await sshExec("pm2 restart rebooked-worker 2>&1");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, output: result.stdout }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/logs" && SSH_USER) {
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

  if (url.pathname === "/api/config") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      host: TARGET_HOST,
      port: TARGET_PORT,
      sshConfigured: !!SSH_USER,
      tokenConfigured: !!API_TOKEN,
    }));
    return;
  }

  // Serve dashboard
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(getDashboardHTML());
});

import { exec as execCb } from "child_process";

server.listen(LOCAL_PORT, () => {
  console.log("");
  console.log("  ========================================");
  console.log("       REBOOKED ADMIN CONSOLE v1.0");
  console.log("  ========================================");
  console.log(`   Dashboard: http://localhost:${LOCAL_PORT}`);
  console.log(`   Target:    ${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`   SSH:       ${SSH_USER ? "configured" : "not configured (set --user)"}`);
  console.log("  ========================================");
  console.log("");

  // Auto-open browser
  const openCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  execCb(`${openCmd} http://localhost:${LOCAL_PORT}`);
});

// ── Embedded Dashboard (for .exe packaging) ──────────────────────────────────
const EMBEDDED_DASHBOARD = "<!-- fallback -->"; // replaced by dashboard.html in build
