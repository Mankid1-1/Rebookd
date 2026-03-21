# 🐳 REBOOKD v2 - DOCKER DEPLOYMENT GUIDE

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Requirements](#system-requirements)
3. [Architecture](#architecture)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Monitoring](#monitoring)
7. [Backup & Restore](#backup--restore)
8. [Troubleshooting](#troubleshooting)
9. [Production Checklist](#production-checklist)

---

## Quick Start

```bash
# 1. Clone repository
git clone https://github.com/yourorg/rebookd2.git
cd rebookd2

# 2. Setup environment
cp .env.production.example .env.production
# Edit .env.production with your values

# 3. Make startup script executable
chmod +x scripts/docker-start.sh

# 4. Initialize and start services
./scripts/docker-start.sh init

# 5. Open application
# App: http://localhost:3000
# Admin: http://localhost:3000/admin (default credentials: admin@rebooked.org / admin)
```

---

## System Requirements

### Hardware (Minimum)
- **CPU**: 2 cores (4 cores recommended)
- **RAM**: 4GB (8GB recommended)
- **Disk**: 50GB SSD (for 40GB MySQL data + OS + logs)
- **Network**: 10Mbps (unlimited bandwidth)

### Software
- **Docker**: 20.10+ ([Install](https://docs.docker.com/install/))
- **Docker Compose**: 2.0+ ([Install](https://docs.docker.com/compose/install/))
- **Git**: Latest ([Install](https://git-scm.com/))
- **OpenSSL**: For certificate generation

### Ports Required
- **80** (HTTP → HTTPS redirect)
- **443** (HTTPS)
- **3306** (MySQL, internal only)
- **6379** (Redis, internal only)
- **3000** (Node app, internal only)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  LOAD BALANCER / ROUTER                     │
│                 (cPanel, AWS, Nginx, etc)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (Port 80, 443)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│           NGINX REVERSE PROXY (Docker Container)            │
│  • SSL/TLS Termination                                       │
│  • Rate Limiting (Auth, API, General)                        │
│  • Request Routing                                           │
│  • Static Asset Caching                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌────────┐     ┌────────┐     ┌────────┐
    │  APP   │     │ WORKER │     │  DB    │
    │ (Node) │     │ (Node) │     │ (MySQL)│
    └────────┘     └────────┘     └────────┘
        │              │              │
        │              │              ▼
        │              │         ┌──────────┐
        │              └────────→│  REDIS   │
        │                        └──────────┘
        └───────────────────────────────────→ [SMS Providers, Email, LLM]
```

### Services

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **nginx** | 80, 443 | Reverse proxy, SSL termination, caching | Required |
| **app** | 3000 | Express.js + tRPC API server | Required |
| **worker** | - | Background automation processor | Required |
| **db** | 3306 | MySQL 8.0 database | Required |
| **redis** | 6379 | Caching, rate limiting, queue | Recommended |

---

## Configuration

### Environment Variables

Copy `.env.production` and update with your values:

```bash
# Core
NODE_ENV=production
PORT=3000
APP_URL=https://app.rebooked.org

# Database
DATABASE_URL=mysql://user:password@db:3306/rebookd

# Security (CRITICAL: Generate unique values!)
JWT_SECRET=<64-char random hex string>
ENCRYPTION_KEY=<64-char hex string>
WEBHOOK_SECRET=<32+ char random string>

# SMS Providers (choose ONE)
TELNYX_API_KEY=<your-api-key>
TELNYX_FROM_NUMBER=+1234567890

# Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
```

### Generate Security Secrets

```bash
# Generate JWT_SECRET (32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate WEBHOOK_SECRET (32+ random chars)
openssl rand -base64 32
```

### SSL Certificates

#### Option A: Let's Encrypt (Automatic)
```bash
# Install Certbot
docker run -it --rm --name certbot \
  -v /path/to/certs:/etc/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  -d app.rebooked.org \
  -d rebooked.org

# Copy certificates to nginx/ssl/
cp /etc/letsencrypt/live/app.rebooked.org/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/app.rebooked.org/privkey.pem nginx/ssl/key.pem
```

#### Option B: Self-Signed (Testing Only)
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

#### Option C: cPanel Auto SSL (If on cPanel)
- Go to cPanel → AutoSSL
- Certificates auto-installed in `nginx/ssl/`

---

## Deployment

### Local Development

```bash
# Start services
./scripts/docker-start.sh up

# View logs
./scripts/docker-start.sh logs app

# Stop services
./scripts/docker-start.sh down
```

### Production Deployment

#### Step 1: Server Setup
```bash
# SSH into server
ssh user@173.249.56.141

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add user to docker group (optional)
sudo usermod -aG docker $USER
```

#### Step 2: Deploy Code
```bash
# Clone repository
git clone https://github.com/yourorg/rebookd2.git
cd rebookd2

# Setup environment
cp .env.production.example .env.production
# Edit with production values
```

#### Step 3: Start Services
```bash
# Make script executable
chmod +x scripts/docker-start.sh

# Initial setup (builds images, runs migrations, seeds DB)
./scripts/docker-start.sh init

# Verify services
./scripts/docker-start.sh ps
```

#### Step 4: Configure DNS
Point your domain to server IP:
```
A record: app.rebooked.org → 173.249.56.141
CNAME: rebooked.org → app.rebooked.org
```

#### Step 5: Enable HTTPS
Configure SSL certificates (see [SSL Certificates](#ssl-certificates) above)

---

## Monitoring

### View Logs

```bash
# App logs
./scripts/docker-start.sh logs app

# Worker logs
./scripts/docker-start.sh logs worker

# Nginx logs
./scripts/docker-start.sh logs nginx

# All services
docker-compose -f docker-compose.prod.yml logs -f

# Follow specific service with tail
./scripts/docker-start.sh logs app -f --tail=100
```

### Health Checks

```bash
# Check all services
./scripts/docker-start.sh health

# Test app endpoint
curl http://localhost:3000/health

# Test database
docker-compose -f docker-compose.prod.yml exec db \
  mysqladmin -u rebookd -p ping

# Test redis
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli ping
```

### Performance Monitoring

```bash
# CPU/Memory usage
docker stats

# Slow MySQL queries
docker-compose -f docker-compose.prod.yml exec db \
  mysql -u rebookd -p -e "SHOW PROCESSLIST;"

# Database size
docker-compose -f docker-compose.prod.yml exec db \
  mysql -u rebookd -p -e "SELECT table_name, ROUND(data_length/1024/1024) AS size_mb FROM information_schema.tables WHERE table_schema='rebookd';"
```

---

## Backup & Restore

### Automated Backups

```bash
# Daily backup at 2 AM
# Add to crontab:
0 2 * * * cd /path/to/rebookd2 && ./scripts/docker-start.sh backup
```

### Manual Backup

```bash
# Backup database
./scripts/docker-start.sh backup

# Output: backups/rebookd_20240101_120000.sql.gz

# Backup files
tar -czf backups/rebookd_files_$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  .
```

### Restore from Backup

```bash
# Restore database
./scripts/docker-start.sh restore backups/rebookd_20240101_120000.sql.gz

# Restore files
tar -xzf backups/rebookd_files_20240101.tar.gz -C /path/to/restore
```

### Remote Backup (S3)

```bash
# Install AWS CLI
pip install awscli

# Backup to S3 (daily)
aws s3 cp backups/rebookd_$(date +%Y%m%d).sql.gz \
  s3://your-bucket/rebookd-backups/

# Or add to backup script:
0 2 * * * cd /path/to/rebookd2 && ./scripts/docker-start.sh backup && \
  aws s3 cp backups/rebookd_*.sql.gz s3://your-bucket/rebookd-backups/
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
./scripts/docker-start.sh logs

# Check service status
./scripts/docker-start.sh ps

# Rebuild images
./scripts/docker-start.sh build

# Restart services
./scripts/docker-start.sh restart
```

### Database Connection Failed

```bash
# Check MySQL is running
docker-compose -f docker-compose.prod.yml exec db mysql -u root -p -e "SELECT 1;"

# Check permissions
docker-compose -f docker-compose.prod.yml exec db \
  mysql -u rebookd -p -e "SHOW GRANTS FOR 'rebookd'@'%';"

# Reset password
docker-compose -f docker-compose.prod.yml exec db \
  mysql -u root -p -e "ALTER USER 'rebookd'@'%' IDENTIFIED BY 'new_password';"
```

### High Memory Usage

```bash
# Check memory per container
docker stats

# Free disk space
docker system prune -a

# Remove old logs
find . -name "*.log" -mtime +30 -delete

# Optimize database
docker-compose -f docker-compose.prod.yml exec db \
  mysql -u root -p -e "OPTIMIZE TABLE rebookd.*;"
```

### Worker Not Processing Automations

```bash
# Check worker is running
./scripts/docker-start.sh ps | grep worker

# Check worker logs
./scripts/docker-start.sh logs worker -f

# Verify database has automations
docker-compose -f docker-compose.prod.yml exec db \
  mysql -u rebookd -p -e "SELECT COUNT(*) FROM automations WHERE enabled=1;"

# Check automation_jobs queue
docker-compose -f docker-compose.prod.yml exec db \
  mysql -u rebookd -p -e "SELECT COUNT(*) FROM automation_jobs WHERE status='pending';"
```

### Disk Space Full

```bash
# Check usage
df -h

# Find largest files
du -sh * | sort -hr | head -20

# Remove old backups
rm backups/rebookd_*_20231*.sql.gz

# Prune Docker
docker system prune -a --volumes

# Archive database
docker-compose -f docker-compose.prod.yml exec db \
  mysqldump -u root -p rebookd | gzip > backups/rebookd_full_$(date +%Y%m%d).sql.gz
```

---

## Production Checklist

- [ ] **Secrets**: All `.env.production` values unique and secure
- [ ] **Database**: Migrations run successfully, no errors
- [ ] **SSL**: Valid certificate installed, auto-renewal configured
- [ ] **DNS**: Domain points to correct IP
- [ ] **Backups**: Daily backups enabled, tested restore process
- [ ] **Monitoring**: Sentry configured, receiving errors
- [ ] **Logging**: Logs aggregated, retention policy set
- [ ] **Rate Limiting**: Configured in Nginx + app
- [ ] **Security Headers**: HSTS, CSP, X-Frame-Options enabled
- [ ] **CORS**: Allowed origins configured
- [ ] **Email**: SMTP working, test email sent
- [ ] **SMS**: Telnyx/Twilio configured, test SMS sent
- [ ] **Payments**: Stripe webhooks configured, test payment processed
- [ ] **Health Checks**: All endpoints responding
- [ ] **Performance**: Load test passed, p95 <500ms
- [ ] **Compliance**: TCPA, GDPR, data retention policies implemented
- [ ] **Documentation**: Runbooks created, team trained

---

## Common Commands

```bash
# View all commands
./scripts/docker-start.sh

# Start services
./scripts/docker-start.sh up

# Stop services
./scripts/docker-start.sh down

# Restart services
./scripts/docker-start.sh restart

# View logs (follow mode)
./scripts/docker-start.sh logs app

# Check status
./scripts/docker-start.sh ps

# Run migrations
./scripts/docker-start.sh migrate

# Backup database
./scripts/docker-start.sh backup

# Restore from backup
./scripts/docker-start.sh restore backups/rebookd_20240101_120000.sql.gz

# Health check
./scripts/docker-start.sh health

# Clean everything
./scripts/docker-start.sh clean
```

---

## Support

- **Documentation**: https://docs.rebooked.org
- **Status Page**: https://status.rebooked.org
- **Support Email**: support@rebooked.org
- **Slack Community**: [Join Workspace](https://rebooked.slack.com)

---

## License

MIT License - See LICENSE file for details
