/**
 * One-shot migration: creates lead_segments and lead_segment_members tables
 * in production if they don't exist. Run with: node scripts/run-migration.mjs
 */

import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Load local .env to get SSH credentials
for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  if (!process.env[key]) process.env[key] = val;
}

function exec(conn, cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve({ stdout: '', stderr: err.message, code: 1 });
      let out = '', errOut = '';
      stream.on('data', d => (out += d.toString()));
      stream.stderr.on('data', d => (errOut += d.toString()));
      stream.on('close', code => resolve({ stdout: out, stderr: errOut, code }));
    });
  });
}

const conn = new Client();

conn.on('ready', async () => {
  console.log('Connected to VPS.');

  // Read DB credentials from server .env
  const envResult = await exec(conn, 'grep "^DB_" /opt/rebooked/.env');
  const env = {};
  for (const line of envResult.stdout.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      env[k] = v;
    }
  }

  const { DB_HOST = 'localhost', DB_USER = 'root', DB_PASSWORD = '', DB_NAME = 'rebooked' } = env;
  console.log(`DB: ${DB_USER}@${DB_HOST}/${DB_NAME}`);

  // Write migration SQL to temp file on server
  const sql = `
CREATE TABLE IF NOT EXISTS lead_segments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7),
  rules JSON,
  isAutomatic TINYINT(1) NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX lead_segments_tenant_idx (tenantId),
  UNIQUE INDEX lead_segments_name_idx (tenantId, name),
  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS lead_segment_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  segmentId INT NOT NULL,
  leadId INT NOT NULL,
  addedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX lead_seg_members_segment_idx (segmentId),
  INDEX lead_seg_members_lead_idx (leadId),
  UNIQUE INDEX lead_seg_members_unique_idx (segmentId, leadId),
  FOREIGN KEY (segmentId) REFERENCES lead_segments(id),
  FOREIGN KEY (leadId) REFERENCES leads(id)
);
  `.trim();

  // Use printf to write without heredoc issues
  const writeCmd = `printf '%s' ${JSON.stringify(sql)} > /tmp/rb_seg_migration.sql`;
  await exec(conn, writeCmd);

  // Find DATABASE_URL in env
  const dbUrlResult = await exec(conn, 'grep -E "DATABASE_URL|MYSQL_URL" /opt/rebooked/.env | head -5');
  console.log('DB URL lines:', JSON.stringify(dbUrlResult.stdout));

  // Parse DATABASE_URL: mysql://user:pass@host/db
  let mysqlCmd = 'mysql rebooked';
  if (dbUrlResult.stdout.trim()) {
    const match = dbUrlResult.stdout.match(/mysql(?:2)?:\/\/([^:]+):([^@]*)@([^/:\n]+)(?::(\d+))?\/([^\s?]+)/);
    if (match) {
      const [, u, p, h, port, db] = match;
      mysqlCmd = `mysql -h ${h} -u ${u} ${p ? `-p'${p}'` : ''} ${port ? `-P ${port}` : ''} ${db}`;
      console.log('Parsed MySQL cmd:', mysqlCmd.replace(p || '', '***'));
    }
  }

  const runCmd = `${mysqlCmd} < /tmp/rb_seg_migration.sql 2>&1`;
  const res = await exec(conn, runCmd);
  console.log('Exit code:', res.code);
  if (res.stdout) console.log('Output:', res.stdout);
  if (res.stderr) console.log('Stderr:', res.stderr);
  if (res.code === 0) console.log('✅ Tables created successfully.');
  else console.error('❌ Migration failed.');

  await exec(conn, 'rm -f /tmp/rb_seg_migration.sql');
  conn.end();
});

conn.on('error', e => {
  console.error('SSH error:', e.message);
  process.exit(1);
});

conn.connect({
  host: process.env.DEPLOY_SSH_HOST || '173.249.56.141',
  port: parseInt(process.env.DEPLOY_SSH_PORT || '22', 10),
  username: process.env.DEPLOY_SSH_USER || 'root',
  password: process.env.DEPLOY_SSH_PASSWORD,
  readyTimeout: 20000,
});
