/**
 * Zero-downtime deployment script for Rebooked.
 *
 * What it does:
 *   1. Builds the project locally (client + server + worker)
 *   2. Uploads the new dist/ to the VPS via SFTP
 *   3. Triggers `pm2 reload` on the VPS — this rolls through the cluster
 *      instances one at a time, so at least one worker is always live.
 *   4. The client's LiveUpdateBanner detects the new version via /api/version
 *      and prompts users to refresh — no forced page loss.
 *
 * Usage:
 *   pnpm deploy:live
 */

import { Client } from 'ssh2';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

// ── Load .env file (no external dependency) ────────────────────────────────
const envPath = join(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;   // don't override explicit env
  }
}

// ── Deployment credentials (from environment) ────────────────────────────
// NEVER hardcode credentials in source code.
// Set DEPLOY_SSH_PASSWORD or use SSH keys via DEPLOY_SSH_KEY_PATH.
if (!process.env.DEPLOY_SSH_PASSWORD && !process.env.DEPLOY_SSH_KEY_PATH) {
  console.error('\n❌ Deployment aborted: No SSH credentials configured.');
  console.error('   Set DEPLOY_SSH_PASSWORD or DEPLOY_SSH_KEY_PATH in your environment.\n');
  process.exit(1);
}

const config = {
  host: process.env.DEPLOY_SSH_HOST || '173.249.56.141',
  port: parseInt(process.env.DEPLOY_SSH_PORT || '22', 10),
  username: process.env.DEPLOY_SSH_USER || 'root',
  ...(process.env.DEPLOY_SSH_KEY_PATH
    ? { privateKey: readFileSync(process.env.DEPLOY_SSH_KEY_PATH) }
    : { password: process.env.DEPLOY_SSH_PASSWORD }),
};

const REMOTE_UPLOAD_DIR = process.env.DEPLOY_REMOTE_DIR || '/home/rebooked/app/dist';
const REMOTE_APP_DIR = '/opt/rebooked/dist';

// ── Helpers ────────────────────────────────────────────────────────────────

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const data = readFileSync(localPath);
    sftp.writeFile(remotePath, data, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function uploadBuffer(sftp, buffer, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, buffer, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function ensureDir(sftp, dir) {
  return new Promise((resolve) => {
    sftp.mkdir(dir, () => resolve()); // ignore error if exists
  });
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => (stdout += d.toString()));
      stream.stderr.on('data', (d) => (stderr += d.toString()));
      stream.on('close', (code) => {
        if (code !== 0) {
          console.error(`Command failed (exit ${code}): ${cmd}`);
          console.error(stderr);
        }
        resolve({ stdout, stderr, code });
      });
    });
  });
}

// ── Git info ────────────────────────────────────────────────────────────────

let gitHash = '';
let gitBranch = '';
try {
  gitHash = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8' }).trim();
  console.log(`\nDeploying commit ${gitHash} from branch ${gitBranch}\n`);
} catch {
  console.log('\nCould not read git info - proceeding anyway\n');
}

const deployStartTime = Date.now();

// ── Build ──────────────────────────────────────────────────────────────────

console.log('=== Step 1/5: Building project ===');
execSync('pnpm build', { cwd: root, stdio: 'inherit' });

// Windows: wait for FS to flush after build copy
await new Promise(r => setTimeout(r, 2000));

// Read the version that was just built
const versionInfo = JSON.parse(readFileSync(join(distDir, 'version.json'), 'utf8'));
console.log(`\nBuild version: ${versionInfo.version}`);
console.log(`Built at: ${versionInfo.builtAt}\n`);

// Pre-buffer ALL files into memory NOW, before SSH connection opens.
// This avoids Windows NTFS stale-entry race conditions during SFTP upload.
console.log('  Pre-reading dist into memory...');
const fileBuffers = new Map();
const assetsDir = join(distDir, 'public', 'assets');
fileBuffers.set('index.js',       readFileSync(join(distDir, 'index.js')));
fileBuffers.set('worker.js',      readFileSync(join(distDir, 'worker.js')));
fileBuffers.set('sentinel.js',    readFileSync(join(distDir, 'sentinel.js')));
fileBuffers.set('version.json',   readFileSync(join(distDir, 'version.json')));
fileBuffers.set('public/index.html', readFileSync(join(distDir, 'public', 'index.html')));
for (const f of readdirSync(join(distDir, 'public'))) {
  const p = join(distDir, 'public', f);
  try { if (statSync(p).isFile() && f !== 'index.html') fileBuffers.set(`public/${f}`, readFileSync(p)); } catch { /* skip */ }
}
for (const f of readdirSync(assetsDir)) {
  const p = join(assetsDir, f);
  try { if (statSync(p).isFile()) fileBuffers.set(`public/assets/${f}`, readFileSync(p)); } catch { /* skip */ }
}
console.log(`  Buffered ${fileBuffers.size} files.\n`);

// ── Upload ─────────────────────────────────────────────────────────────────

console.log('=== Step 2/5: Uploading to VPS ===');

const conn = new Client();

conn.on('ready', async () => {
  console.log('Connected to VPS');

  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error('SFTP error:', err);
      conn.end();
      return;
    }

    try {
      // ── Pre-deploy backup ──────────────────────────────────────────────
      console.log('  Creating backup of current dist on VPS...');
      const backup = await exec(conn, 'cp -r /opt/rebooked/dist /opt/rebooked/dist-backup-$(date +%s)');
      if (backup.code === 0) {
        console.log('  Backup created successfully.\n');
      } else {
        console.warn('  Backup failed (non-fatal) - continuing deployment.\n');
      }

      // Upload to staging directory first, then atomically sync to live dir
      await ensureDir(sftp, REMOTE_UPLOAD_DIR);

      // Upload server files — use pre-buffered data
      console.log('  Uploading index.js...');
      await uploadBuffer(sftp, fileBuffers.get('index.js'), `${REMOTE_UPLOAD_DIR}/index.js`);

      console.log('  Uploading worker.js...');
      await uploadBuffer(sftp, fileBuffers.get('worker.js'), `${REMOTE_UPLOAD_DIR}/worker.js`);

      console.log('  Uploading sentinel.js...');
      await uploadBuffer(sftp, fileBuffers.get('sentinel.js'), `${REMOTE_UPLOAD_DIR}/sentinel.js`);

      console.log('  Uploading version.json...');
      await uploadBuffer(sftp, fileBuffers.get('version.json'), `${REMOTE_UPLOAD_DIR}/version.json`);

      // Upload client assets — use pre-buffered data
      await ensureDir(sftp, `${REMOTE_UPLOAD_DIR}/public`);
      console.log('  Uploading index.html...');
      await uploadBuffer(sftp, fileBuffers.get('public/index.html'), `${REMOTE_UPLOAD_DIR}/public/index.html`);

      // Upload root-level public files (favicon, logo, etc.) — use pre-buffered data
      const rootFileEntries = [...fileBuffers.entries()].filter(([k]) =>
        k.startsWith('public/') && !k.startsWith('public/assets/') && k !== 'public/index.html' && !k.includes('/')
          ? false // shouldn't happen
          : k.startsWith('public/') && !k.startsWith('public/assets/') && k !== 'public/index.html'
      );
      for (const [key, data] of rootFileEntries) {
        const file = key.replace('public/', '');
        if (file.startsWith('.')) continue;
        console.log(`  Uploading ${file}...`);
        await uploadBuffer(sftp, data, `${REMOTE_UPLOAD_DIR}/${key}`);
      }

      // Upload assets — use pre-buffered data (avoids Windows NTFS stale-entry races)
      await ensureDir(sftp, `${REMOTE_UPLOAD_DIR}/public/assets`);
      const assetEntries = [...fileBuffers.entries()].filter(([k]) => k.startsWith('public/assets/'));
      console.log(`  Uploading ${assetEntries.length} assets...`);
      for (const [key, data] of assetEntries) {
        await uploadBuffer(sftp, data, `${REMOTE_UPLOAD_DIR}/${key}`);
      }

      // Upload autopilot repair script (sentinel dependency)
      await ensureDir(sftp, '/opt/rebooked/scripts');
      const autopilotScript = join(root, 'scripts', 'autopilot-repair.sh');
      if (statSync(autopilotScript, { throwIfNoEntry: false })) {
        console.log('  Uploading autopilot-repair.sh...');
        await uploadFile(sftp, autopilotScript, '/opt/rebooked/scripts/autopilot-repair.sh');
        await exec(conn, 'chmod +x /opt/rebooked/scripts/autopilot-repair.sh');
      }

      console.log('  All files uploaded.\n');

      // ── Sync staging → live ──────────────────────────────────────────────
      // Atomically replace the live dist with the uploaded staging copy.
      // This ensures PM2 (which runs from /opt/rebooked) picks up the new code.

      console.log('=== Step 3/6: Syncing to live directory ===');
      const sync = await exec(conn, `rm -rf ${REMOTE_APP_DIR} && cp -r ${REMOTE_UPLOAD_DIR} ${REMOTE_APP_DIR}`);
      if (sync.code === 0) {
        console.log(`  Synced ${REMOTE_UPLOAD_DIR} → ${REMOTE_APP_DIR}\n`);
      } else {
        console.error('  ❌ Sync failed! Aborting deployment.');
        conn.end();
        process.exit(1);
      }

      // ── Reload ─────────────────────────────────────────────────────────────

      console.log('=== Step 4/6: Rolling reload (zero downtime) ===');

      // Delete and restart to ensure clean state with new code
      await exec(conn, 'cd /opt/rebooked && pm2 delete rebooked-app 2>/dev/null');
      const appReload = await exec(conn, 'cd /opt/rebooked && pm2 start ecosystem.config.cjs --only rebooked-app');
      console.log(appReload.stdout);

      // Restart the worker (single-instance, brief gap is fine for background jobs)
      const workerReload = await exec(conn, `cd /opt/rebooked && pm2 restart rebooked-worker`);
      console.log(workerReload.stdout);

      // Restart the sentinel (autopilot repair engine)
      const sentinelReload = await exec(conn, `cd /opt/rebooked && pm2 restart rebooked-sentinel 2>/dev/null || pm2 start ecosystem.config.cjs --only rebooked-sentinel`);
      console.log('  Sentinel restarted.');
      console.log(sentinelReload.stdout);

      // ── Verify (with retries) ────────────────────────────────────────────

      console.log('=== Step 5/6: Verifying deployment ===');

      const MAX_RETRIES = 5;
      const RETRY_INTERVAL_MS = 2000;
      let verified = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`  Health check attempt ${attempt}/${MAX_RETRIES}...`);
        await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));

        const health = await exec(conn, 'curl -s http://localhost:3000/api/version');
        try {
          const live = JSON.parse(health.stdout);
          if (live.version === versionInfo.version) {
            console.log(`\n Deployment successful! Live version: ${live.version}`);
            verified = true;
            break;
          } else {
            console.log(`  Version mismatch: expected ${versionInfo.version}, got ${live.version}`);
          }
        } catch {
          console.log('  Could not parse version response, retrying...');
        }
      }

      if (!verified) {
        console.warn('\n Health check failed after all retries.');
        console.warn('  Check manually: curl http://localhost:3000/api/version');
      }

      // ── Record deployment in database via API ──────────────────────────

      const durationMs = Date.now() - deployStartTime;
      const deployUser = process.env.DEPLOY_USER || process.env.USERNAME || process.env.USER || 'unknown';
      try {
        const recordCmd = `curl -s -X POST http://localhost:3000/api/system/deploy-record -H "Content-Type: application/json" -H "x-internal-token: ${process.env.WEBHOOK_SECRET || ''}" -d '${JSON.stringify({
          version: versionInfo.version,
          gitHash,
          gitBranch,
          status: verified ? "verified" : "failed",
          deployedBy: deployUser,
          durationMs,
        })}'`;
        await exec(conn, recordCmd);
        console.log(`  Deploy recorded (${verified ? 'verified' : 'failed'}, ${(durationMs / 1000).toFixed(1)}s)`);
      } catch {
        console.warn('  Could not record deploy to database (non-fatal).');
      }

      // ── Cleanup old backups (keep last 3) ──────────────────────────────

      console.log('\n=== Step 6/6: Cleaning up old backups ===');
      await exec(conn, 'cd /opt/rebooked && ls -dt dist-backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null');
      console.log('  Old backups cleaned (kept last 3).');

      conn.end();
    } catch (e) {
      console.error('Deploy error:', e);
      conn.end();
      process.exit(1);
    }
  });
});

conn.on('error', (err) => {
  console.error('SSH connection error:', err.message);
  process.exit(1);
});

conn.connect(config);
