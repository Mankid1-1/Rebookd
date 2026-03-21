# 🚀 VPS Deployment Guide - Rebooked

## 📋 Server Specifications

```
IP: 173.249.56.141
Bandwidth: Unlimited
Disk Space: 40GB (40,960 MB)
Virtual Domains: 5
Subdomains: 10
MySQL Databases: 5
SSH Access: ON
SSL: ON
PHP: ON
```

### **Server Details**
- **Temporary URL**: `http://173.249.56.141/~rebooked`
- **FTP Server**: `ftp.rebooked.org`
- **Email Servers**: `mail.rebooked.org` (SMTP/POP3)
- **DNS Servers**: `ns1.server-173-249-56-141.da.direct`, `ns2.server-173-249-56-141.da.direct`

---

## 🎯 Deployment Strategy

### **Option 1: Docker Deployment (Recommended)**
- Containerized application
- Easy management and scaling
- Isolated environment
- Quick deployment

### **Option 2: Direct Node.js Deployment**
- Native Node.js installation
- Direct file deployment
- System service management
- Performance optimized

---

## 🐳 Option 1: Docker Deployment

### **1. Install Docker on VPS**
```bash
# SSH into your server
ssh root@173.249.56.141

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker service
systemctl start docker
systemctl enable docker
```

### **2. Deploy Application**
```bash
# Create application directory
mkdir -p /opt/rebooked
cd /opt/rebooked

# Upload your application files
# (Use scp or FTP to transfer files from your local machine)

# Extract and build
tar -xzf rebooked.tar.gz
cd rebooked

# Build and start services
docker-compose up -d --build

# Check status
docker-compose ps
docker-compose logs -f
```

### **3. Production Docker Compose**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: runner
    ports:
      - "80:3000"
      - "443:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: mysql://rebooked:password@db:3306/rebooked
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      # Email configuration
      SMTP_HOST: mail.rebooked.org
      SMTP_PORT: 587
      SMTP_USER: noreply@rebooked.org
      SMTP_PASS: ${SMTP_PASSWORD}
      POP3_HOST: mail.rebooked.org
      POP3_PORT: 995
      POP3_USER: noreply@rebooked.org
      POP3_PASSWORD: ${POP3_PASSWORD}
      # SMS providers
      TELNYX_API_KEY: ${TELNYX_API_KEY}
      TELNYX_FROM_NUMBER: ${TELNYX_FROM_NUMBER}
      TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID}
      TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN}
      TWILIO_FROM_NUMBER: ${TWILIO_FROM_NUMBER}
      # Other services
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SENDGRID_API_KEY: ${SENDGRID_API_KEY}
      SENTRY_DSN: ${SENTRY_DSN}
    depends_on:
      - db
      - migrate
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    networks:
      - rebooked-network

  worker:
    build:
      context: .
      target: runner
    command: ["node", "dist/worker.js"]
    environment:
      NODE_ENV: production
      DATABASE_URL: mysql://rebooked:password@db:3306/rebooked
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      # Email configuration
      SMTP_HOST: mail.rebooked.org
      SMTP_PORT: 587
      SMTP_USER: noreply@rebooked.org
      SMTP_PASS: ${SMTP_PASSWORD}
      POP3_HOST: mail.rebooked.org
      POP3_PORT: 995
      POP3_USER: noreply@rebooked.org
      POP3_PASSWORD: ${POP3_PASSWORD}
      # SMS providers
      TELNYX_API_KEY: ${TELNYX_API_KEY}
      TELNYX_FROM_NUMBER: ${TELNYX_FROM_NUMBER}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - db
      - migrate
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    networks:
      - rebooked-network

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: rebooked
      MYSQL_USER: rebooked
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
      - ./drizzle/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "3306:3306"
    restart: unless-stopped
    networks:
      - rebooked-network

  migrate:
    build:
      context: .
      target: migrate
    environment:
      DATABASE_URL: mysql://rebooked:password@db:3306/rebooked
    depends_on:
      db:
        condition: service_healthy
    networks:
      - rebooked-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - rebooked-network

volumes:
  db_data:

networks:
  rebooked-network:
    driver: bridge
```

---

## 🖥️ Option 2: Direct Node.js Deployment

### **1. Install Node.js on VPS**
```bash
# SSH into server
ssh root@173.249.56.141

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install MySQL client
apt install -y mysql-client

# Install Nginx
apt install -y nginx
```

### **2. Setup Database**
```bash
# Create MySQL database and user
mysql -u root -p << EOF
CREATE DATABASE rebooked;
CREATE USER 'rebooked'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON rebooked.* TO 'rebooked'@'localhost';
FLUSH PRIVILEGES;
EXIT;
EOF

# Test connection
mysql -u rebooked -p rebooked
```

### **3. Deploy Application Files**
```bash
# Create application directory
mkdir -p /var/www/rebooked
cd /var/www/rebooked

# Upload and extract application
# (Use scp or FTP to transfer files)
tar -xzf rebooked.tar.gz

# Install dependencies
npm ci --production

# Run database migrations
npm run db:migrate

# Create logs directory
mkdir -p logs
```

### **4. Environment Configuration**
```bash
# Create production .env file
cat > .env << EOF
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=mysql://rebooked:your_secure_password@localhost:3306/rebooked

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Email
SMTP_HOST=mail.rebooked.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@rebooked.org
SMTP_PASS=your_smtp_password
POP3_HOST=mail.rebooked.org
POP3_PORT=995
POP3_TLS=true
POP3_USER=noreply@rebooked.org
POP3_PASSWORD=your_pop3_password
EMAIL_FROM_ADDRESS=noreply@rebooked.org

# SMS Providers
TELNYX_API_KEY=your_telnyx_key
TELNYX_FROM_NUMBER=your_telnyx_number
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=your_twilio_number

# Other Services
STRIPE_SECRET_KEY=your_stripe_key
OPENAI_API_KEY=your_openai_key
SENDGRID_API_KEY=your_sendgrid_key
SENTRY_DSN=your_sentry_dsn
EOF
```

### **5. PM2 Configuration**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'rebooked-app',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/app-error.log',
      out_file: './logs/app-out.log',
      log_file: './logs/app-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'rebooked-worker',
      script: 'dist/worker.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true,
      max_memory_restart: '512M'
    }
  ]
};
```

### **6. Start Application**
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions to enable startup on boot

# Check status
pm2 status
pm2 logs
```

---

## 🌐 Nginx Configuration

### **1. Create Nginx Config**
```nginx
# /etc/nginx/sites-available/rebooked
server {
    listen 80;
    server_name rebooked.org www.rebooked.org;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rebooked.org www.rebooked.org;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rebooked.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rebooked.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # API Rate Limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Login Rate Limiting
    location /api/trpc/auth.login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static Files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health Check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

### **2. Enable Site**
```bash
# Enable site
ln -s /etc/nginx/sites-available/rebooked /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

---

## 🔒 SSL Certificate Setup

### **1. Install Certbot**
```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d rebooked.org -d www.rebooked.org

# Setup auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

### **2. Test SSL**
```bash
# Test SSL configuration
openssl s_client -connect rebooked.org:443 -servername rebooked.org

# Check certificate
certbot certificates
```

---

## 🔧 System Configuration

### **1. Firewall Setup**
```bash
# Install UFW
apt install -y ufw

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3306/tcp  # MySQL (if remote access needed)

# Enable firewall
ufw enable
```

### **2. System Monitoring**
```bash
# Install monitoring tools
apt install -y htop iotop nethogs

# Setup log rotation
cat > /etc/logrotate.d/rebooked << EOF
/var/www/rebooked/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### **3. Backup Script**
```bash
# Create backup script
cat > /opt/rebooked/backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/opt/backups/rebooked"
DATE=\$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/rebooked"

# Create backup directory
mkdir -p \$BACKUP_DIR

# Backup database
mysqldump -u rebooked -p'your_password' rebooked > \$BACKUP_DIR/db_\$DATE.sql

# Backup application files
tar -czf \$BACKUP_DIR/app_\$DATE.tar.gz -C \$APP_DIR .

# Keep only last 7 days
find \$BACKUP_DIR -name "*.sql" -mtime +7 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: \$DATE"
EOF

chmod +x /opt/rebooked/backup.sh

# Add to cron (daily at 2 AM)
echo "0 2 * * * /opt/rebooked/backup.sh" | crontab -
```

---

## 📊 Performance Optimization

### **1. MySQL Optimization**
```sql
-- /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
max_connections = 100
query_cache_size = 64M
query_cache_type = 1
```

### **2. Node.js Optimization**
```bash
# Increase file descriptor limit
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Optimize PM2
pm2 update
pm2 install pm2-server-monit
```

---

## 🚀 Deployment Commands

### **Quick Deployment (Docker)**
```bash
# 1. SSH into server
ssh root@173.249.56.141

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 3. Deploy application
git clone https://github.com/your-repo/rebooked.git
cd rebooked

# 4. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 5. Start services
docker-compose -f docker-compose.prod.yml up -d --build

# 6. Setup SSL
certbot --nginx -d rebooked.org -d www.rebooked.org
```

### **Quick Deployment (Node.js)**
```bash
# 1. SSH into server
ssh root@173.249.56.141

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Deploy application
cd /var/www
git clone https://github.com/your-repo/rebooked.git
cd rebooked

# 4. Setup and start
npm ci --production
npm run build
pm2 start ecosystem.config.js

# 5. Setup Nginx and SSL
# (Follow SSL setup instructions above)
```

---

## 📋 Pre-Deployment Checklist

### **✅ Server Preparation**
- [ ] SSH access configured
- [ ] Domain DNS pointed to server
- [ ] SSL certificate obtained
- [ ] Firewall configured
- [ ] Database created

### **✅ Application Configuration**
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Email credentials configured
- [ ] SMS providers configured
- [ ] SSL certificates installed

### **✅ Production Setup**
- [ ] Nginx configured
- [ ] PM2/Docker services running
- [ ] Log rotation setup
- [ ] Backup script configured
- [ ] Monitoring setup

### **✅ Testing**
- [ ] Application accessible via domain
- [ ] HTTPS working
- [ ] Database connections working
- [ ] Email sending/receiving working
- [ ] SMS sending working

---

## 🔍 Monitoring & Maintenance

### **Daily Checks**
```bash
# Check application status
pm2 status
docker-compose ps

# Check logs
pm2 logs
docker-compose logs

# Check system resources
htop
df -h
free -m
```

### **Weekly Maintenance**
```bash
# Update system
apt update && apt upgrade -y

# Check SSL certificates
certbot certificates

# Rotate logs
logrotate -f /etc/logrotate.conf

# Check backups
ls -la /opt/backups/rebooked
```

---

## 🎯 Go Live!

Once deployed, your application will be available at:
- **Temporary**: `http://173.249.56.141/~rebooked`
- **Permanent**: `https://rebooked.org`

### **Access Points**
- **Main Application**: `https://rebooked.org`
- **Admin Panel**: `https://rebooked.org/admin`
- **API**: `https://rebooked.org/api/trpc`
- **Health Check**: `https://rebooked.org/health`

---

**🚀 Your Rebooked application is now ready for VPS deployment! Choose your preferred deployment method and follow the step-by-step instructions.**
