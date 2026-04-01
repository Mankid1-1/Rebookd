/**
 * Root-based deploy script — uploads dist/ to /home/rebooked/app/ as root.
 */
import { Client } from 'ssh2';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

const REMOTE_APP_DIR = '/opt/rebooked/dist';

const config = {
  host: '173.249.56.141',
  port: 22,
  username: 'root',
  password: 'V7xLEt8HC4ch',
};

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
    sftp.mkdir(dir, () => resolve());
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
          console.error(`  [exit ${code}] ${cmd}`);
          if (stderr) console.error(' ', stderr.trim());
        }
        resolve({ stdout, stderr, code });
      });
    });
  });
}

const conn = new Client();

conn.on('ready', async () => {
  console.log('✅ Connected as root\n');

  conn.sftp(async (err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }

    try {
      // --- Ensure directories exist ---
      console.log('=== Creating remote directories ===');
      await ensureDir(sftp, REMOTE_APP_DIR);
      await ensureDir(sftp, `${REMOTE_APP_DIR}/public`);
      await ensureDir(sftp, `${REMOTE_APP_DIR}/public/assets`);

      // --- Upload server files ---
      console.log('\n=== Uploading server files ===');
      console.log('  index.js...');
      await uploadFile(sftp, join(distDir, 'index.js'), `${REMOTE_APP_DIR}/index.js`);
      console.log('  worker.js...');
      await uploadFile(sftp, join(distDir, 'worker.js'), `${REMOTE_APP_DIR}/worker.js`);
      console.log('  version.json...');
      await uploadFile(sftp, join(distDir, 'version.json'), `${REMOTE_APP_DIR}/version.json`);

      // --- Upload public files ---
      console.log('\n=== Uploading public/ files ===');
      const publicRoot = join(distDir, 'public');
      const rootFiles = readdirSync(publicRoot).filter(f => {
        if (!statSync(join(publicRoot, f)).isFile()) return false;
        if (f.startsWith('.')) return false;
        return true;
      });
      for (const file of rootFiles) {
        console.log(`  ${file}...`);
        await uploadFile(sftp, join(publicRoot, file), `${REMOTE_APP_DIR}/public/${file}`);
      }

      // --- Upload assets ---
      const assetsDir = join(distDir, 'public', 'assets');
      const assets = readdirSync(assetsDir).filter(f => statSync(join(assetsDir, f)).isFile());
      console.log(`\n=== Uploading ${assets.length} assets ===`);
      for (const file of assets) {
        process.stdout.write(`  ${file}...\r`);
        await uploadFile(sftp, join(assetsDir, file), `${REMOTE_APP_DIR}/public/assets/${file}`);
      }
      console.log('\n  All assets uploaded.          ');

      // --- Fix ownership ---
      console.log('\n=== Fixing ownership ===');
      const chown = await exec(conn, `chown -R rebooked:rebooked ${REMOTE_APP_DIR}`);
      if (chown.code === 0) console.log('  Ownership set to rebooked:rebooked');

      // --- Add calendar env vars if missing ---
      console.log('\n=== Checking calendar env vars ===');
      const envCheck = await exec(conn, `grep -c 'GOOGLE_CALENDAR_CLIENT_ID' /opt/rebooked/.env 2>/dev/null || echo 0`);
      if (envCheck.stdout.trim() === '0') {
        console.log('  Adding blank calendar env vars...');
        const envVars = [
          '',
          '# Calendar Integration (configure via OAuth apps)',
          'GOOGLE_CALENDAR_CLIENT_ID=',
          'GOOGLE_CALENDAR_CLIENT_SECRET=',
          'MICROSOFT_CLIENT_ID=',
          'MICROSOFT_CLIENT_SECRET=',
          'MICROSOFT_TENANT_ID=common',
          'CALENDLY_CLIENT_ID=',
          'CALENDLY_CLIENT_SECRET=',
          'ACUITY_API_KEY=',
          'CALENDAR_SYNC_INTERVAL_MINUTES=5',
          'APP_URL=https://rebooked.org',
        ].join('\n');
        await exec(conn, `printf '${envVars.replace(/'/g, "'\\''")}' >> /opt/rebooked/.env`);
        console.log('  Calendar env vars appended.');
      } else {
        console.log('  Calendar env vars already present, skipping.');
      }

      // --- Reload PM2 (runs as root) ---
      console.log('\n=== Reloading PM2 ===');
      const pm2List = await exec(conn, 'pm2 list');
      console.log(pm2List.stdout);

      const reload = await exec(conn, 'pm2 reload all --update-env');
      console.log(reload.stdout);
      if (reload.stderr) console.log(reload.stderr);

      // --- Health check ---
      console.log('\n=== Health check ===');
      await new Promise(r => setTimeout(r, 3000));
      const health = await exec(conn, 'curl -s http://localhost:3000/api/version 2>/dev/null || echo "not responding"');
      console.log('  /api/version:', health.stdout.trim());

      const versionInfo = JSON.parse(readFileSync(join(distDir, 'version.json'), 'utf8'));
      console.log(`\n✅ Deploy complete! Expected version: ${versionInfo.version}`);

    } catch (e) {
      console.error('❌ Deploy error:', e);
      conn.end();
      process.exit(1);
    }

    conn.end();
  });
});

conn.on('error', (err) => {
  console.error('❌ SSH error:', err.message);
  process.exit(1);
});

conn.connect(config);
