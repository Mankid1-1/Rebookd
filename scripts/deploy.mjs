import { Client } from 'ssh2';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

const config = {
  host: '173.249.56.141',
  port: 22,
  username: 'rebooked',
  password: 'MuvxqubynWbm69BbBgRc',
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
    sftp.mkdir(dir, () => resolve()); // ignore error if exists
  });
}

async function deploy() {
  const conn = new Client();

  conn.on('ready', async () => {
    console.log('Connected to server');

    conn.sftp(async (err, sftp) => {
      if (err) { console.error('SFTP error:', err); conn.end(); return; }

      try {
        // Upload index.js and worker.js
        console.log('Uploading index.js...');
        await uploadFile(sftp, join(distDir, 'index.js'), '/home/rebooked/app/index.js');
        console.log('Uploading worker.js...');
        await uploadFile(sftp, join(distDir, 'worker.js'), '/home/rebooked/app/worker.js');

        // Upload public/index.html
        console.log('Uploading index.html...');
        await ensureDir(sftp, '/home/rebooked/app/public');
        await uploadFile(sftp, join(distDir, 'public', 'index.html'), '/home/rebooked/app/public/index.html');

        // Upload all assets
        await ensureDir(sftp, '/home/rebooked/app/public/assets');
        const assetsDir = join(distDir, 'public', 'assets');
        const files = readdirSync(assetsDir);
        console.log(`Uploading ${files.length} assets...`);

        for (const file of files) {
          const localPath = join(assetsDir, file);
          if (!statSync(localPath).isFile()) continue;
          await uploadFile(sftp, localPath, `/home/rebooked/app/public/assets/${file}`);
        }
        console.log('All assets uploaded');

        // Update proxy.php to use correct port
        console.log('Updating proxy.php...');
        const proxyContent = readFileSync(join(distDir, '..', 'scripts', 'proxy-template.php'), 'utf8').replace('__PORT__', '3006');
        sftp.writeFile('/home/rebooked/domains/rebooked.org/public_html/proxy.php', proxyContent, (writeErr) => {
          if (writeErr) console.error('Proxy upload error:', writeErr);
          else console.log('proxy.php updated');
        });

        // Update .env PORT
        console.log('Updating .env PORT to 3006...');
        sftp.readFile('/home/rebooked/app/.env', 'utf8', (readErr, envData) => {
          if (readErr) { console.error('Failed to read .env:', readErr); }
          else {
            const updated = envData.replace(/^PORT=\d+/m, 'PORT=3006');
            sftp.writeFile('/home/rebooked/app/.env', updated, (wErr) => {
              if (wErr) console.error('Failed to write .env:', wErr);
              else console.log('.env updated to PORT=3006');

              console.log('\nDeploy complete! Cron will restart the app within 60 seconds.');
              conn.end();
            });
          }
        });

      } catch (e) {
        console.error('Upload error:', e);
        conn.end();
      }
    });
  });

  conn.on('error', (err) => {
    console.error('Connection error:', err.message);
  });

  conn.connect(config);
}

deploy();
