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
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

const config = {
  host: '173.249.56.141',
  port: 22,
  username: 'rebooked',
  password: 'MuvxqubynWbm69BbBgRc',
};

const REMOTE_APP_DIR = '/home/rebooked/app';

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

// ── Build ──────────────────────────────────────────────────────────────────

console.log('=== Step 1/4: Building project ===');
execSync('pnpm build', { cwd: root, stdio: 'inherit' });

// Read the version that was just built
const versionInfo = JSON.parse(readFileSync(join(distDir, 'version.json'), 'utf8'));
console.log(`\nBuild version: ${versionInfo.version}`);
console.log(`Built at: ${versionInfo.builtAt}\n`);

// ── Upload ─────────────────────────────────────────────────────────────────

console.log('=== Step 2/4: Uploading to VPS ===');

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
      // Upload server files
      console.log('  Uploading index.js...');
      await uploadFile(sftp, join(distDir, 'index.js'), `${REMOTE_APP_DIR}/index.js`);

      console.log('  Uploading worker.js...');
      await uploadFile(sftp, join(distDir, 'worker.js'), `${REMOTE_APP_DIR}/worker.js`);

      console.log('  Uploading version.json...');
      await uploadFile(sftp, join(distDir, 'version.json'), `${REMOTE_APP_DIR}/version.json`);

      // Upload client assets
      await ensureDir(sftp, `${REMOTE_APP_DIR}/public`);
      console.log('  Uploading index.html...');
      await uploadFile(sftp, join(distDir, 'public', 'index.html'), `${REMOTE_APP_DIR}/public/index.html`);

      await ensureDir(sftp, `${REMOTE_APP_DIR}/public/assets`);
      const assetsDir = join(distDir, 'public', 'assets');
      const files = readdirSync(assetsDir);
      console.log(`  Uploading ${files.length} assets...`);

      for (const file of files) {
        const localPath = join(assetsDir, file);
        if (!statSync(localPath).isFile()) continue;
        await uploadFile(sftp, localPath, `${REMOTE_APP_DIR}/public/assets/${file}`);
      }

      console.log('  All files uploaded.\n');

      // ── Reload ─────────────────────────────────────────────────────────────

      console.log('=== Step 3/4: Rolling reload (zero downtime) ===');

      // Reload the app workers one-by-one (cluster mode)
      const appReload = await exec(conn, `cd ${REMOTE_APP_DIR} && pm2 reload rebooked-app`);
      console.log(appReload.stdout);

      // Restart the worker (single-instance, brief gap is fine for background jobs)
      const workerReload = await exec(conn, `cd ${REMOTE_APP_DIR} && pm2 restart rebooked-worker`);
      console.log(workerReload.stdout);

      // ── Verify ───────────────────────────────────────────────────────────

      console.log('=== Step 4/4: Verifying deployment ===');

      // Wait a moment for the new workers to settle
      await new Promise((r) => setTimeout(r, 3000));

      const health = await exec(conn, 'curl -s http://localhost:3006/api/version');
      try {
        const live = JSON.parse(health.stdout);
        if (live.version === versionInfo.version) {
          console.log(`\n Deployment successful! Live version: ${live.version}`);
        } else {
          console.warn(`\n Version mismatch — expected ${versionInfo.version}, got ${live.version}`);
          console.warn('  The old instance may still be draining. Check again in a few seconds.');
        }
      } catch {
        console.warn('\n Could not verify version. Check manually: curl http://localhost:3006/api/version');
      }

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
