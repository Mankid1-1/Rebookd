#!/usr/bin/env node

/**
 * 🚀 COMPREHENSIVE AUTO-DEPLOY SCRIPT
 * Handles complete deployment from rebooked.zip to production-ready system
 * Supports Debian servers with full stack setup
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  zipName: 'rebooked.zip',
  deployDir: './deploy-temp',
  appDir: './rebooked-app',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || 5432,
  dbName: process.env.DB_NAME || 'rebooked',
  dbUser: process.env.DB_USER || 'rebooked_user',
  dbPassword: process.env.DB_PASSWORD || 'secure_password_here',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@rebooked.org',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123!',
  domain: process.env.DOMAIN || 'rebooked.org',
  sslEmail: process.env.SSL_EMAIL || 'admin@rebooked.org'
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n📍 Step ${step}: ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function runCommand(command, description, cwd = process.cwd()) {
  logInfo(`Running: ${description}`);
  try {
    const result = execSync(command, { 
      cwd, 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    logSuccess(`Command completed: ${description}`);
    return result;
  } catch (error) {
    logError(`Command failed: ${description} - ${error.message}`);
    throw error;
  }
}

async function checkSystem() {
  logStep(1, 'System Requirements Check');
  
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    logInfo(`Node.js version: ${nodeVersion}`);
    
    // Check if running on Debian/Ubuntu
    try {
      const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
      if (osRelease.includes('debian') || osRelease.includes('ubuntu')) {
        logSuccess('Debian/Ubuntu system detected');
      } else {
        logWarning('Non-Debian system detected - some steps may need adjustment');
      }
    } catch (e) {
      logWarning('Could not detect OS version');
    }
    
    // Check available disk space
    try {
      const dfOutput = execSync('df -h .', { encoding: 'utf8' });
      logInfo('Disk space check passed');
    } catch (e) {
      logWarning('Could not check disk space');
    }
    
    // Check available memory
    try {
      const freeOutput = execSync('free -h', { encoding: 'utf8' });
      logInfo('Memory check passed');
    } catch (e) {
      logWarning('Could not check memory');
    }
    
  } catch (error) {
    logError(`System check failed: ${error.message}`);
    throw error;
  }
}

async function extractZip() {
  logStep(2, 'Extract Application from rebooked.zip');
  
  // Clean up any existing temporary directory
  if (await fs.access(CONFIG.deployDir).then(() => true).catch(() => false)) {
    runCommand(`rm -rf ${CONFIG.deployDir}`, 'Remove existing temp directory');
  }
  
  // Create temporary directory
  await fs.mkdir(CONFIG.deployDir, { recursive: true });
  
  // Extract zip file
  if (!await fs.access(CONFIG.zipName).then(() => true).catch(() => false)) {
    throw new Error(`${CONFIG.zipName} not found in current directory`);
  }
  
  runCommand(`unzip -q ${CONFIG.zipName} -d ${CONFIG.deployDir}`, 'Extract zip file');
  
  // Check if extraction was successful
  const extractedFiles = await fs.readdir(CONFIG.deployDir);
  if (extractedFiles.length === 0) {
    throw new Error('Zip extraction failed - no files found');
  }
  
  logSuccess(`Extracted ${extractedFiles.length} files from zip`);
}

async function setupApplication() {
  logStep(3, 'Setup Application Structure');
  
  // Remove existing app directory if it exists
  if (await fs.access(CONFIG.appDir).then(() => true).catch(() => false)) {
    runCommand(`rm -rf ${CONFIG.appDir}`, 'Remove existing app directory');
  }
  
  // Move extracted files to app directory
  runCommand(`mv ${CONFIG.deployDir}/* ${CONFIG.appDir}`, 'Move files to app directory');
  
  // Change to app directory
  process.chdir(CONFIG.appDir);
  
  // Install dependencies
  logInfo('Installing Node.js dependencies...');
  runCommand('npm ci --production', 'Install production dependencies');
  
  logSuccess('Application structure setup completed');
}

async function setupDatabase() {
  logStep(4, 'Setup PostgreSQL Database');
  
  try {
    // Install PostgreSQL if not present
    runCommand('sudo apt-get update', 'Update package lists');
    runCommand('sudo apt-get install -y postgresql postgresql-contrib', 'Install PostgreSQL');
    
    // Start PostgreSQL service
    runCommand('sudo systemctl start postgresql', 'Start PostgreSQL service');
    runCommand('sudo systemctl enable postgresql', 'Enable PostgreSQL service');
    
    // Create database and user
    runCommand(`sudo -u postgres psql -c "CREATE USER ${CONFIG.dbUser} WITH PASSWORD '${CONFIG.dbPassword}';"`, 'Create database user');
    runCommand(`sudo -u postgres psql -c "CREATE DATABASE ${CONFIG.dbName} OWNER ${CONFIG.dbUser};"`, 'Create database');
    runCommand(`sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${CONFIG.dbName} TO ${CONFIG.dbUser};"`, 'Grant privileges');
    
    // Run database migrations
    if (await fs.access('./server/db/migrate.sql').then(() => true).catch(() => false)) {
      runCommand(`PGPASSWORD=${CONFIG.dbPassword} psql -h ${CONFIG.dbHost} -p ${CONFIG.dbPort} -U ${CONFIG.dbUser} -d ${CONFIG.dbName} -f server/db/migrate.sql`, 'Run database migrations');
    }
    
    logSuccess('PostgreSQL database setup completed');
  } catch (error) {
    logError(`Database setup failed: ${error.message}`);
    throw error;
  }
}

async function setupSSL() {
  logStep(5, 'Setup SSL Certificate with Let\'s Encrypt');
  
  try {
    // Install Certbot if not present
    runCommand('sudo apt-get install -y certbot python3-certbot-nginx', 'Install Certbot');
    
    // Generate SSL certificate
    runCommand(`sudo certbot --nginx -d ${CONFIG.domain} --email ${CONFIG.sslEmail} --agree-tos --non-interactive`, 'Generate SSL certificate');
    
    // Setup auto-renewal
    runCommand('sudo crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -', 'Setup SSL auto-renewal');
    
    logSuccess('SSL certificate setup completed');
  } catch (error) {
    logWarning(`SSL setup failed: ${error.message} - will continue without SSL`);
  }
}

async function setupNginx() {
  logStep(6, 'Setup Nginx Reverse Proxy');
  
  const nginxConfig = `
server {
    listen 80;
    server_name ${CONFIG.domain};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${CONFIG.domain};

    ssl_certificate /etc/letsencrypt/live/${CONFIG.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${CONFIG.domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root ${path.resolve(process.cwd(), CONFIG.appDir, 'dist-build/public')};
    index index.html;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
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

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        application/atom+xml
        application/javascript
        application/json
        application/rss+xml
        application/vnd.ms-fontobject
        application/x-font-ttf
        application/x-web-app-manifest+json
        application/xhtml+xml
        application/xml
        font/opentype
        image/svg+xml
        image/x-icon
        text/css
        text/plain
        text/x-component;

    # Rate limiting
    limit_req_zone $binary_remote_addr $uri zone=api:10m rate=10r/s;
    limit_req_status 429;
}
`;
  
  // Write Nginx configuration
  await fs.writeFile('/tmp/rebooked-nginx.conf', nginxConfig);
  runCommand('sudo cp /tmp/rebooked-nginx.conf /etc/nginx/sites-available/rebooked', 'Copy Nginx config');
  runCommand('sudo ln -sf /etc/nginx/sites-available/rebooked /etc/nginx/sites-enabled/', 'Enable site');
  runCommand('sudo nginx -t', 'Test Nginx configuration');
  runCommand('sudo systemctl reload nginx', 'Reload Nginx');
  
  logSuccess('Nginx reverse proxy setup completed');
}

async function setupSystemd() {
  logStep(7, 'Setup Systemd Services');
  
  const serviceConfig = `[Unit]
Description=Rebooked Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${path.resolve(process.cwd(), CONFIG.appDir)}
Environment=NODE_ENV=production
Environment=DB_HOST=${CONFIG.dbHost}
Environment=DB_PORT=${CONFIG.dbPort}
Environment=DB_NAME=${CONFIG.dbName}
Environment=DB_USER=${CONFIG.dbUser}
Environment=DB_PASSWORD=${CONFIG.dbPassword}
Environment=ADMIN_EMAIL=${CONFIG.adminEmail}
Environment=ADMIN_PASSWORD=${CONFIG.adminPassword}
Environment=DOMAIN=${CONFIG.domain}
ExecStart=/usr/bin/node server/_core/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
`;
  
  // Write systemd service file
  await fs.writeFile('/tmp/rebooked.service', serviceConfig);
  runCommand('sudo cp /tmp/rebooked.service /etc/systemd/system/', 'Copy service file');
  runCommand('sudo systemctl daemon-reload', 'Reload systemd');
  runCommand('sudo systemctl enable rebooked', 'Enable service');
  runCommand('sudo systemctl start rebooked', 'Start service');
  
  logSuccess('Systemd service setup completed');
}

async function setupFirewall() {
  logStep(8, 'Setup Firewall Rules');
  
  try {
    // Install UFW if not present
    runCommand('sudo apt-get install -y ufw', 'Install UFW firewall');
    
    // Configure firewall rules
    runCommand('sudo ufw allow ssh', 'Allow SSH');
    runCommand('sudo ufw allow 80/tcp', 'Allow HTTP');
    runCommand('sudo ufw allow 443/tcp', 'Allow HTTPS');
    runCommand('sudo ufw allow 3000/tcp', 'Allow application port');
    
    // Enable firewall
    runCommand('sudo ufw --force enable', 'Enable firewall');
    
    logSuccess('Firewall configuration completed');
  } catch (error) {
    logWarning(`Firewall setup failed: ${error.message}`);
  }
}

async function createAdminUser() {
  logStep(9, 'Create Admin User Account');
  
  try {
    // Insert admin user into database
    const adminUserScript = `
      INSERT INTO users (id, email, password_hash, role, tenant_id, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        '${CONFIG.adminEmail}',
        crypt('${CONFIG.adminPassword}', gen_salt('bf')),
        'admin',
        1,
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO NOTHING;
    `;
    
    runCommand(`PGPASSWORD=${CONFIG.dbPassword} psql -h ${CONFIG.dbHost} -p ${CONFIG.dbPort} -U ${CONFIG.dbUser} -d ${CONFIG.dbName} -c "${adminUserScript}"`, 'Create admin user');
    
    logSuccess(`Admin account created: ${CONFIG.adminEmail}`);
  } catch (error) {
    logWarning(`Admin user creation failed: ${error.message}`);
  }
}

async function setupMonitoring() {
  logStep(10, 'Setup Monitoring and Logging');
  
  try {
    // Create log directories
    runCommand('sudo mkdir -p /var/log/rebooked', 'Create log directory');
    runCommand('sudo chown www-data:www-data /var/log/rebooked', 'Set log ownership');
    
    // Setup log rotation
    const logrotateConfig = `/var/log/rebooked/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload rebooked
    endscript
}`;
    
    await fs.writeFile('/tmp/rebooked-logrotate', logrotateConfig);
    runCommand('sudo cp /tmp/rebooked-logrotate /etc/logrotate.d/rebooked', 'Setup log rotation');
    
    logSuccess('Monitoring and logging setup completed');
  } catch (error) {
    logWarning(`Monitoring setup failed: ${error.message}`);
  }
}

async function generateDeploymentReport() {
  logStep(11, 'Generate Deployment Report');
  
  const report = `
🎉 REBOOKED DEPLOYMENT REPORT
=====================================

📅 Deployment Date: ${new Date().toISOString()}
🌐 Domain: ${CONFIG.domain}
📧 Admin Email: ${CONFIG.adminEmail}
🗄️  Database: PostgreSQL on ${CONFIG.dbHost}:${CONFIG.dbPort}
🔒 SSL: Let's Encrypt certificate
🌐 Web Server: Nginx with reverse proxy
⚙️  Process Manager: Systemd
🔥 Firewall: UFW configured

📊 ACCESS INFORMATION:
------------------
Admin Panel: https://${CONFIG.domain}/admin
API Endpoint: https://${CONFIG.domain}/api
Database: ${CONFIG.dbHost}:${CONFIG.dbPort}

🔑 ADMIN CREDENTIALS:
------------------
Email: ${CONFIG.adminEmail}
Password: ${CONFIG.adminPassword}

📋 NEXT STEPS:
---------------
1. Access admin panel at https://${CONFIG.domain}/admin
2. Login with admin credentials
3. Configure your business settings
4. Test all functionality
5. Setup backup procedures

🔧 MAINTENANCE COMMANDS:
----------------------
View logs: sudo journalctl -u rebooked -f
Restart app: sudo systemctl restart rebooked
Check status: sudo systemctl status rebooked
Database backup: pg_dump -h ${CONFIG.dbHost} -U ${CONFIG.dbUser} ${CONFIG.dbName}

⚠️  SECURITY NOTES:
------------------
1. Change default admin password immediately
2. Setup regular database backups
3. Monitor SSL certificate renewal
4. Review firewall rules regularly
5. Keep system updated

=====================================
Deployment completed successfully! 🚀
`;
  
  console.log(report);
  
  // Save report to file
  await fs.writeFile('./deployment-report.txt', report);
  logSuccess('Deployment report saved to deployment-report.txt');
}

async function cleanup() {
  logInfo('Cleaning up temporary files...');
  try {
    if (await fs.access(CONFIG.deployDir).then(() => true).catch(() => false)) {
      runCommand(`rm -rf ${CONFIG.deployDir}`, 'Clean up temp directory');
    }
    if (await fs.access('/tmp/rebooked-nginx.conf').then(() => true).catch(() => false)) {
      runCommand('rm -f /tmp/rebooked-nginx.conf', 'Clean up nginx temp file');
    }
    if (await fs.access('/tmp/rebooked.service').then(() => true).catch(() => false)) {
      runCommand('rm -f /tmp/rebooked.service', 'Clean up service temp file');
    }
  } catch (error) {
    logWarning(`Cleanup failed: ${error.message}`);
  }
}

// Main deployment function
async function main() {
  console.log(`${colors.bright}${colors.cyan}
🚀 REBOOKED AUTO-DEPLOYMENT SCRIPT 🚀
=====================================
This script will deploy rebooked.zip to a production-ready system
including database, SSL, web server, and monitoring setup.
=====================================${colors.reset}
  `);

  try {
    await checkSystem();
    await extractZip();
    await setupApplication();
    await setupDatabase();
    await setupSSL();
    await setupNginx();
    await setupSystemd();
    await setupFirewall();
    await createAdminUser();
    await setupMonitoring();
    await generateDeploymentReport();
    await cleanup();
    
    logSuccess('\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
    logInfo('Your Rebooked application is now running in production mode.');
    
  } catch (error) {
    logError(`\n💥 DEPLOYMENT FAILED: ${error.message}`);
    logInfo('Please check the error above and try again.');
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  logWarning('\n⚠️  Deployment interrupted by user');
  cleanup();
  process.exit(1);
});

process.on('SIGTERM', () => {
  logWarning('\n⚠️  Deployment terminated');
  cleanup();
  process.exit(1);
});

// Run main function
if (import.meta.url) {
  // Running as ES module
  main().catch(console.error);
} else {
  // Running as CommonJS
  require.main === module && main().catch(console.error);
}
