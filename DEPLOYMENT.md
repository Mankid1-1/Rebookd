# Rebooked V2 — Production Deployment Guide

## Server Requirements

- **OS**: Debian/Ubuntu Linux
- **RAM**: 2GB minimum (4GB+ recommended)
- **Node.js**: v20.x LTS
- **Database**: MariaDB 10.6+ or MySQL 8.0+
- **Web Server**: Apache or Nginx (DirectAdmin handles this)
- **SSL**: Managed by Cloudflare (or DirectAdmin Let's Encrypt)

---

## 1. Server Setup (Root Access Required)

### 1.1 Install Node.js via nvm

```bash
# As the hosting user (e.g., 'rebooked'):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
node --version  # Should show v20.x.x
```

### 1.2 Create the Database

Via DirectAdmin panel or MySQL CLI:

```sql
-- As MySQL root:
CREATE DATABASE rebooked_rebooked CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rebooked_rebooked'@'localhost' IDENTIFIED BY 'YOUR_SECURE_DB_PASSWORD';
GRANT ALL PRIVILEGES ON rebooked_rebooked.* TO 'rebooked_rebooked'@'localhost';
FLUSH PRIVILEGES;
```

### 1.3 Push Database Schema

Upload `scripts/full-schema-deploy.sql` to the server and run:

```bash
mysql -u rebooked_rebooked -p'YOUR_SECURE_DB_PASSWORD' rebooked_rebooked < ~/app/full-schema-deploy.sql
```

Verify tables:
```bash
mysql -u rebooked_rebooked -p'YOUR_SECURE_DB_PASSWORD' rebooked_rebooked -e "SHOW TABLES;"
```

Expected: 27 tables (users, tenants, leads, automations, templates, etc.)

---

## 2. Application Deployment

### 2.1 Upload Build Files

The build produces three outputs:
- `dist/index.js` — Main server (Express + tRPC API + static file serving)
- `dist/worker.js` — Background worker (SMS sending, email processing, automation jobs)
- `dist/public/` — Frontend build (React SPA with all assets)

Upload to `/home/rebooked/app/`:

```bash
# On your local machine (where you build):
cd /path/to/rebookd2
npm run build   # or: node scripts/build.mjs

# Upload via SCP:
scp dist/index.js dist/worker.js user@server:~/app/
scp -r dist/public/* user@server:~/app/public/
```

Or via FTP, upload the contents of `dist/` to `~/app/`.

### 2.2 Install Node.js Dependencies

```bash
cd ~/app
# Upload package.json to ~/app/ first
npm install --omit=dev
```

### 2.3 Create Environment File

Create `~/app/.env` with all production values:

```bash
cat > ~/app/.env << 'EOF'
# Application
NODE_ENV=production
PORT=3000

# Database (localhost since app runs on same server)
DATABASE_URL=mysql://rebooked_rebooked:YOUR_DB_PASSWORD@localhost:3306/rebooked_rebooked

# Auth / Security
JWT_SECRET=GENERATE_A_RANDOM_64_CHAR_STRING
SESSION_SECRET=GENERATE_ANOTHER_RANDOM_STRING
ENCRYPTION_KEY=GENERATE_A_32_BYTE_HEX_KEY

# Stripe (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
STRIPE_FIXED_PRICE_ID=price_YOUR_FIXED_PRICE
STRIPE_METERED_PRICE_ID=price_YOUR_METERED_PRICE

# Telnyx SMS (get from https://portal.telnyx.com)
TELNYX_API_KEY=KEY_YOUR_TELNYX_KEY
TELNYX_FROM_NUMBER=+1XXXXXXXXXX

# CORS — list all domains that should access the API
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# App URL (used for OAuth callbacks, email links, etc.)
APP_URL=https://yourdomain.com
VITE_OAUTH_PORTAL_URL=https://yourdomain.com

# Optional: Sentry error tracking
# SENTRY_DSN=https://xxx@sentry.io/xxx

# Optional: OpenAI for AI-powered message generation
# OPENAI_API_KEY=sk-xxx

# Optional: SMTP for email notifications
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your@email.com
# SMTP_PASS=your-app-password
EOF

chmod 600 ~/app/.env
```

**IMPORTANT**: Generate secure random values:
```bash
# Generate JWT_SECRET:
openssl rand -hex 32

# Generate ENCRYPTION_KEY (32 bytes hex):
openssl rand -hex 32
```

---

## 3. Process Management

### Option A: systemd (VPS with root access — Recommended)

```bash
# As root:
cat > /etc/systemd/system/rebooked.service << 'EOF'
[Unit]
Description=Rebooked V2 App
After=network.target mysql.service

[Service]
Type=simple
User=rebooked
WorkingDirectory=/home/rebooked/app
ExecStart=/home/rebooked/.nvm/versions/node/v20.20.2/bin/node /home/rebooked/app/index.js
Restart=always
RestartSec=5
EnvironmentFile=/home/rebooked/app/.env

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/rebooked-worker.service << 'EOF'
[Unit]
Description=Rebooked V2 Worker
After=network.target mysql.service

[Service]
Type=simple
User=rebooked
WorkingDirectory=/home/rebooked/app
ExecStart=/home/rebooked/.nvm/versions/node/v20.20.2/bin/node /home/rebooked/app/worker.js
Restart=always
RestartSec=5
EnvironmentFile=/home/rebooked/app/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rebooked rebooked-worker
systemctl start rebooked rebooked-worker

# Check status
systemctl status rebooked
systemctl status rebooked-worker

# View logs
journalctl -u rebooked -f
journalctl -u rebooked-worker -f
```

> **NOTE**: Adjust the node binary path. Find yours with: `su - rebooked -c 'source ~/.nvm/nvm.sh && which node'`

### Option B: PM2 (VPS alternative)

```bash
npm install -g pm2

cat > ~/app/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'rebooked',
    script: './index.js',
    cwd: '/home/rebooked/app',
    node_args: '--env-file=.env',
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production' }
  }, {
    name: 'rebooked-worker',
    script: './worker.js',
    cwd: '/home/rebooked/app',
    node_args: '--env-file=.env',
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
    env: { NODE_ENV: 'production' }
  }]
};
EOF

cd ~/app && pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # Follow output instructions (requires sudo)
```

### Option C: Cron-based (DirectAdmin shared hosting — no root)

Create startup scripts that check if the app is already running before starting:

```bash
# ~/app/cron-app.sh
cat > ~/app/cron-app.sh << 'SCRIPT'
#!/bin/bash
while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  export "$key=$value"
done < /home/rebooked/app/.env

APP_PORT="${PORT:-3000}"
if curl -sf -o /dev/null http://127.0.0.1:${APP_PORT}/health 2>/dev/null; then
  exit 0
fi
exec /home/rebooked/.nvm/versions/node/v20.20.2/bin/node /home/rebooked/app/index.js >> /home/rebooked/domains/rebooked.org/logs/app.log 2>&1
SCRIPT
chmod +x ~/app/cron-app.sh

# ~/app/cron-worker.sh — same pattern for worker
```

Add via DirectAdmin Cron Jobs panel: `*/1 * * * * /home/rebooked/app/cron-app.sh`

---

## 4. Reverse Proxy Setup

### Option A: Nginx (Recommended for VPS)

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/rebooked.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Option B: Apache mod_proxy

```apache
<VirtualHost *:443>
    ServerName yourdomain.com
    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    RequestHeader set X-Forwarded-Proto "https"
</VirtualHost>
```

### Option C: PHP Proxy (DirectAdmin shared hosting — no root)

If mod_proxy is blocked, use a PHP proxy script. See `proxy.php` in the repository.

Create `.htaccess` in `public_html/`:
```apache
RewriteEngine On
RewriteRule ^proxy\.php$ - [L]
RewriteRule ^\.well-known/ - [L]
RewriteRule ^(.*)$ proxy.php [L,QSA]
```

---

## 5. Stripe Webhook Setup

1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
4. Copy the signing secret (`whsec_...`) to `.env` as `STRIPE_WEBHOOK_SECRET`

---

## 6. DNS / Cloudflare Setup

If using Cloudflare:
1. Add A record: `yourdomain.com` -> `YOUR_SERVER_IP` (Proxied)
2. Add A record: `www` -> `YOUR_SERVER_IP` (Proxied)
3. SSL/TLS: Set to **Full (Strict)** if server has valid cert, or **Full** with self-signed

---

## 7. Health Monitoring

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `/health` | DB, memory, uptime check | No |
| `/ready` | DB + worker readiness | No |

Set up monitoring (UptimeRobot, etc.) on `/health` every 5 minutes.

Healthy response:
```json
{"status":"ok","db":"connected","uptime":12345,"memory":{"rss":130,"heapUsed":40,"heapTotal":45},"version":"2.0.0"}
```

---

## 8. Updating / Redeployment

```bash
# Build locally:
cd /path/to/rebookd2
git pull && npm install && node scripts/build.mjs

# Upload:
scp dist/index.js dist/worker.js user@server:~/app/
scp -r dist/public/* user@server:~/app/public/

# Restart:
ssh user@server 'sudo systemctl restart rebooked rebooked-worker'
# or: ssh user@server 'cd ~/app && pm2 restart all'
```

---

## 9. Troubleshooting

| Problem | Check |
|---------|-------|
| 502 Bad Gateway | `curl http://127.0.0.1:3000/health` — is Node running? |
| DB connection fails | `mysql -u rebooked_rebooked -p -h localhost rebooked_rebooked -e "SELECT 1"` |
| Black screen | Browser F12 Console for JS errors; verify assets in `~/app/public/` |
| Process keeps dying | Check logs: `tail -100 ~/logs/app.log` |

---

## 10. Architecture

```
Browser -> Cloudflare (CDN/SSL) -> Nginx/Apache -> Node.js (port 3000)
                                                   ├── Static files (public/)
                                                   ├── tRPC API (/api/trpc/*)
                                                   ├── Stripe webhooks
                                                   ├── Telnyx webhooks
                                                   └── Health checks

                                                   Worker (background)
                                                   ├── SMS automation jobs
                                                   ├── Email processing
                                                   └── Scheduled tasks

                                                   MariaDB (localhost:3306)
                                                   └── 27 tables
```
