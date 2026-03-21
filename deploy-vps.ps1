# VPS Deployment Script for Rebooked (PowerShell)
# Server: 173.249.56.141
# This script automates the complete deployment process

param(
    [string]$ServerIP = "173.249.56.141",
    [string]$ServerUser = "root",
    [string]$Domain = "rebooked.org"
)

# Colors for output
$colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
}

function Write-Log {
    param([string]$Message, [string]$Color = "Green")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $colors[$Color]
    Add-Content -Path "deploy-vps-$(Get-Date -Format 'yyyyMMdd_HHmmss').log" -Value "[$timestamp] $Message"
}

function Write-Error-Log {
    param([string]$Message)
    Write-Log $Message "Red"
    exit 1
}

function Write-Warning-Log {
    param([string]$Message)
    Write-Log $Message "Yellow"
}

function Write-Info-Log {
    param([string]$Message)
    Write-Log $Message "Blue"
}

function Check-Requirements {
    Write-Log "Checking requirements..."
    
    # Check for SSH
    try {
        $null = Get-Command ssh -ErrorAction Stop
    } catch {
        Write-Error-Log "SSH is required but not installed. Please install OpenSSH."
    }
    
    # Check for SCP
    try {
        $null = Get-Command scp -ErrorAction Stop
    } catch {
        Write-Error-Log "SCP is required but not installed. Please install OpenSSH."
    }
    
    Write-Log "Requirements check passed"
}

function New-EnvironmentTemplate {
    Write-Log "Creating environment template..."
    
    $envContent = @"
# VPS Production Environment
NODE_ENV=production
PORT=3000

# Database Configuration
DB_ROOT_PASSWORD=$( -join ((1..32) | ForEach-Object { [char](Get-Random -Maximum 94 -Minimum 33) }))
DB_PASSWORD=$( -join ((1..32) | ForEach-Object { [char](Get-Random -Maximum 94 -Minimum 33) }))

# Security
JWT_SECRET=$( -join ((1..64) | ForEach-Object { ('0123456789ABCDEF'[(Get-Random -Maximum 16)]) }))
ENCRYPTION_KEY=$( -join ((1..64) | ForEach-Object { ('0123456789ABCDEF'[(Get-Random -Maximum 16)]) }))
WEBHOOK_SECRET=$( -join ((1..64) | ForEach-Object { ('0123456789ABCDEF'[(Get-Random -Maximum 16)]) }))

# Email Configuration (mail.rebooked.org)
SMTP_HOST=mail.rebooked.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@rebooked.org
SMTP_PASS=your_smtp_password_here
EMAIL_FROM_ADDRESS=noreply@rebooked.org

POP3_HOST=mail.rebooked.org
POP3_PORT=995
POP3_TLS=true
POP3_USER=noreply@rebooked.org
POP3_PASSWORD=your_pop3_password_here

# SMS Providers
TELNYX_API_KEY=your_telnyx_api_key_here
TELNYX_FROM_NUMBER=your_telnyx_number_here
TELNYX_PUBLIC_KEY=your_telnyx_public_key_here
TWILIO_ACCOUNT_SID=your_twilio_sid_here
TWILIO_AUTH_TOKEN=your_twilio_token_here
TWILIO_FROM_NUMBER=your_twilio_number_here

# Payment Processing
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here

# AI Services
OPENAI_API_KEY=your_openai_api_key_here

# Email Service
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Monitoring
SENTRY_DSN=your_sentry_dsn_here

# Application Settings
APP_URL=https://rebooked.org
CORS_ORIGIN=https://rebooked.org
COOKIE_DOMAIN=.rebooked.org

# Timeouts and Limits
SMS_HTTP_TIMEOUT_MS=30000
DATA_API_TIMEOUT_MS=30000
DB_QUERY_TIMEOUT_MS=5000
SMS_RATE_LIMIT=100
SMS_HOURLY_CAP=1000
SMS_DAILY_CAP_PER_TENANT=5000

# Phone Settings
PHONE_DEFAULT_REGION=US
INBOUND_AUTO_CREATE_LEADS=true
MIN_INBOUND_LEAD_BODY_LEN=1
TCPA_STOP_REPLY_TEXT=You have been unsubscribed from SMS. Reply START to opt back in.
"@
    
    $envContent | Out-File -FilePath ".env.vps" -Encoding UTF8
    Write-Log "Environment template created at .env.vps"
    Write-Warning-Log "Please edit .env.vps with your actual credentials before deployment"
}

function New-ServerSetupScript {
    $serverScript = @"
#!/bin/bash

# Server-side setup script
set -e

echo "Starting server setup..."

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl wget git unzip htop iotop nethogs ufw

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl start docker
    systemctl enable docker
    usermod -aG docker www-data
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Install Certbot for SSL
apt install -y certbot python3-certbot-nginx

# Install Nginx
apt install -y nginx

# Setup firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create application directories
mkdir -p /opt/rebooked
mkdir -p /opt/rebooked/logs
mkdir -p /opt/rebooked/uploads
mkdir -p /opt/rebooked/ssl
mkdir -p /opt/rebooked/backups

# Set permissions
chown -R www-data:www-data /opt/rebooked
chmod -R 755 /opt/rebooked

# Setup log rotation
cat > /etc/logrotate.d/rebooked << 'EOL'
/opt/rebooked/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
EOL

# Setup backup script
cat > /opt/rebooked/backup.sh << 'EOL'
#!/bin/bash
BACKUP_DIR="/opt/rebooked/backups"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Backup Docker volumes
docker run --rm -v rebooked_db_data:/data -v \$BACKUP_DIR:/backup alpine tar czf /backup/db_\$DATE.tar.gz -C /data .
docker run --rm -v rebooked_redis_data:/data -v \$BACKUP_DIR:/backup alpine tar czf /backup/redis_\$DATE.tar.gz -C /data .

# Keep only last 7 days
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: \$DATE"
EOL

chmod +x /opt/rebooked/backup.sh

# Add backup to cron
echo "0 2 * * * /opt/rebooked/backup.sh" | crontab -

echo "Server setup completed!"
"@
    
    $serverScript | Out-File -FilePath "server-setup.sh" -Encoding UTF8
}

function Deploy-ToVPS {
    Write-Log "Starting deployment to VPS..."
    
    New-ServerSetupScript
    
    # Upload and execute server setup
    Write-Log "Uploading server setup script..."
    scp server-setup.sh "${ServerUser}@${ServerIP}:/tmp/"
    
    Write-Log "Executing server setup..."
    ssh "${ServerUser}@${ServerIP}" "chmod +x /tmp/server-setup.sh && /tmp/server-setup.sh"
    
    # Upload application files
    Write-Log "Uploading application files..."
    
    # Create tarball of application
    $excludeFiles = @(
        ".git",
        "node_modules",
        "dist",
        "*.log",
        ".env*",
        "deploy-vps.*",
        "server-setup.sh"
    )
    
    $tarCommand = "tar -czf rebooked-deploy.tar.gz"
    foreach ($exclude in $excludeFiles) {
        $tarCommand += " --exclude=$exclude"
    }
    $tarCommand += " ."
    
    Invoke-Expression $tarCommand
    
    # Upload tarball
    scp rebooked-deploy.tar.gz "${ServerUser}@${ServerIP}:/tmp/"
    
    # Extract on server
    ssh "${ServerUser}@${ServerIP}" "cd /opt/rebooked && tar -xzf /tmp/rebooked-deploy.tar.gz && rm /tmp/rebooked-deploy.tar.gz"
    
    # Setup permissions on server
    ssh "${ServerUser}@${ServerIP}" "chown -R www-data:www-data /opt/rebooked && chmod -R 755 /opt/rebooked"
    
    # Clean up local tarball
    Remove-Item rebooked-deploy.tar.gz -Force
    
    Write-Log "Files uploaded successfully"
}

function Set-SSL {
    Write-Log "Setting up SSL certificate..."
    
    $sslScript = @"
# Wait for DNS to propagate (if needed)
sleep 30

# Generate SSL certificate
certbot --nginx -d ${Domain} -d www.${Domain} --non-interactive --agree-tos --email admin@${Domain} || {
    echo "SSL generation failed, using self-signed certificate for now"
    mkdir -p /opt/rebooked/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /opt/rebooked/ssl/rebooked.org.key \
        -out /opt/rebooked/ssl/rebooked.org.crt \
        -subj "/C=US/ST=State/L=City/O=Rebooked/CN=${Domain}"
}
"@
    
    ssh "${ServerUser}@${ServerIP}" $sslScript
    
    Write-Log "SSL setup completed"
}

function Start-Application {
    Write-Log "Starting application..."
    
    $startScript = @"
cd /opt/rebooked

# Load environment variables
if [ -f .env.vps ]; then
    export \$(cat .env.vps | xargs)
fi

# Start with Docker Compose
docker-compose -f docker-compose.vps.yml down
docker-compose -f docker-compose.vps.yml up -d --build

# Wait for services to start
sleep 30

# Check status
docker-compose -f docker-compose.vps.yml ps

# Show logs
echo "=== Application Logs ==="
docker-compose -f docker-compose.vps.yml logs app
"@
    
    ssh "${ServerUser}@${ServerIP}" $startScript
    
    Write-Log "Application started"
}

function Test-Health {
    Write-Log "Performing health check..."
    
    $tempUrl = "http://${ServerIP}/~rebooked"
    
    # Wait for application to start
    Start-Sleep -Seconds 60
    
    try {
        $response = Invoke-WebRequest -Uri "$tempUrl/health" -UseBasicParsing -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-Log "✅ Health check passed - Application is responding"
        } else {
            Write-Error-Log "❌ Health check failed - Application returned status $($response.StatusCode)"
        }
    } catch {
        Write-Error-Log "❌ Health check failed - Application is not responding"
    }
    
    try {
        $response = Invoke-WebRequest -Uri "$tempUrl/ready" -UseBasicParsing -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-Log "✅ Ready check passed - All services are ready"
        } else {
            Write-Warning-Log "⚠️ Ready check failed - Some services may not be ready yet"
        }
    } catch {
        Write-Warning-Log "⚠️ Ready check failed - Some services may not be ready yet"
    }
}

function Show-Summary {
    Write-Log "Deployment completed successfully!"
    Write-Host ""
    Write-Host "=== DEPLOYMENT SUMMARY ===" -ForegroundColor Cyan
    Write-Host "Server IP: $ServerIP"
    Write-Host "Domain: $Domain"
    Write-Host "Temporary URL: http://$ServerIP/~rebooked"
    Write-Host "Production URL: https://$Domain"
    Write-Host ""
    Write-Host "=== ACCESS POINTS ===" -ForegroundColor Cyan
    Write-Host "Main Application: https://$Domain"
    Write-Host "Admin Panel: https://$Domain/admin"
    Write-Host "API: https://$Domain/api/trpc"
    Write-Host "Health Check: https://$Domain/health"
    Write-Host ""
    Write-Host "=== NEXT STEPS ===" -ForegroundColor Yellow
    Write-Host "1. Update DNS to point to $ServerIP"
    Write-Host "2. Configure your email accounts in hosting panel"
    Write-Host "3. Update .env.vps with actual credentials"
    Write-Host "4. Restart application:"
    Write-Host "   ssh $ServerUser@$ServerIP 'cd /opt/rebooked && docker-compose -f docker-compose.vps.yml restart'"
    Write-Host ""
    Write-Host "=== MONITORING ===" -ForegroundColor Cyan
    Write-Host "Check logs: ssh $ServerUser@$ServerIP 'cd /opt/rebooked && docker-compose -f docker-compose.vps.yml logs -f'"
    Write-Host "Check status: ssh $ServerUser@$ServerIP 'cd /opt/rebooked && docker-compose -f docker-compose.vps.yml ps'"
    Write-Host "Backup: ssh $ServerUser@$ServerIP '/opt/rebooked/backup.sh'"
    Write-Host ""
    Write-Log "Deployment completed successfully! 🚀"
}

# Main execution
function Main {
    Write-Log "Starting VPS deployment for Rebooked"
    Write-Host ""
    
    Check-Requirements
    New-EnvironmentTemplate
    
    Write-Host ""
    Write-Warning-Log "Please edit .env.vps with your actual credentials before continuing"
    $continue = Read-Host "Press Enter to continue or Ctrl+C to exit"
    
    if (-not (Test-Path ".env.vps")) {
        Write-Error-Log ".env.vps file not found"
    }
    
    Deploy-ToVPS
    Set-SSL
    Start-Application
    Test-Health
    Show-Summary
}

# Run main function
Main
