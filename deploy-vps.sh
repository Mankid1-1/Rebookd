#!/bin/bash

# VPS Deployment Script for Rebooked
# Server: 173.249.56.141
# This script automates the complete deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server configuration
SERVER_IP="173.249.56.141"
SERVER_USER="root"
DOMAIN="rebooked.org"
TEMP_URL="http://173.249.56.141/~rebooked"

# Logging
LOG_FILE="deploy-vps-$(date +%Y%m%d_%H%M%S).log"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if required tools are installed
check_requirements() {
    log "Checking requirements..."
    
    if ! command -v ssh &> /dev/null; then
        error "SSH is required but not installed"
    fi
    
    if ! command -v scp &> /dev/null; then
        error "SCP is required but not installed"
    fi
    
    log "Requirements check passed"
}

# Create environment file template
create_env_template() {
    log "Creating environment template..."
    
    cat > .env.vps << EOF
# VPS Production Environment
NODE_ENV=production
PORT=3000

# Database Configuration
DB_ROOT_PASSWORD=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 32)

# Security
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 32)

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
EOF

    log "Environment template created at .env.vps"
    warning "Please edit .env.vps with your actual credentials before deployment"
}

# Deploy to VPS
deploy_to_vps() {
    log "Starting deployment to VPS..."
    
    # Create deployment script for server
    cat > server-setup.sh << 'EOF'
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

# Install Nginx if not using Docker Nginx
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
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup Docker volumes
docker run --rm -v rebooked_db_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/db_$DATE.tar.gz -C /data .
docker run --rm -v rebooked_redis_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/redis_$DATE.tar.gz -C /data .

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOL

chmod +x /opt/rebooked/backup.sh

# Add backup to cron
echo "0 2 * * * /opt/rebooked/backup.sh" | crontab -

echo "Server setup completed!"
EOF

    # Upload and execute server setup
    log "Uploading server setup script..."
    scp server-setup.sh ${SERVER_USER}@${SERVER_IP}:/tmp/
    
    log "Executing server setup..."
    ssh ${SERVER_USER}@${SERVER_IP} "chmod +x /tmp/server-setup.sh && /tmp/server-setup.sh"
    
    # Upload application files
    log "Uploading application files..."
    scp -r . ${SERVER_USER}@${SERVER_IP}:/opt/rebooked/
    
    # Setup permissions on server
    ssh ${SERVER_USER}@${SERVER_IP} "chown -R www-data:www-data /opt/rebooked && chmod -R 755 /opt/rebooked"
    
    log "Files uploaded successfully"
}

# Generate SSL certificate
setup_ssl() {
    log "Setting up SSL certificate..."
    
    ssh ${SERVER_USER}@${SERVER_IP} << EOF
# Wait for DNS to propagate (if needed)
sleep 30

# Generate SSL certificate
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} || {
    echo "SSL generation failed, using self-signed certificate for now"
    mkdir -p /opt/rebooked/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /opt/rebooked/ssl/rebooked.org.key \
        -out /opt/rebooked/ssl/rebooked.org.crt \
        -subj "/C=US/ST=State/L=City/O=Rebooked/CN=${DOMAIN}"
}
EOF
    
    log "SSL setup completed"
}

# Start application
start_application() {
    log "Starting application..."
    
    ssh ${SERVER_USER}@${SERVER_IP} << EOF
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
EOF
    
    log "Application started"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for application to start
    sleep 60
    
    # Check health endpoint
    if curl -f -s "${TEMP_URL}/health" > /dev/null; then
        log "✅ Health check passed - Application is responding"
    else
        error "❌ Health check failed - Application is not responding"
    fi
    
    # Check ready endpoint
    if curl -f -s "${TEMP_URL}/ready" > /dev/null; then
        log "✅ Ready check passed - All services are ready"
    else
        warning "⚠️ Ready check failed - Some services may not be ready yet"
    fi
}

# Show deployment summary
show_summary() {
    log "Deployment completed successfully!"
    echo ""
    echo "=== DEPLOYMENT SUMMARY ==="
    echo "Server IP: ${SERVER_IP}"
    echo "Domain: ${DOMAIN}"
    echo "Temporary URL: ${TEMP_URL}"
    echo "Production URL: https://${DOMAIN}"
    echo ""
    echo "=== ACCESS POINTS ==="
    echo "Main Application: https://${DOMAIN}"
    echo "Admin Panel: https://${DOMAIN}/admin"
    echo "API: https://${DOMAIN}/api/trpc"
    echo "Health Check: https://${DOMAIN}/health"
    echo ""
    echo "=== NEXT STEPS ==="
    echo "1. Update DNS to point to ${SERVER_IP}"
    echo "2. Configure your email accounts in hosting panel"
    echo "3. Update .env.vps with actual credentials"
    echo "4. Restart application: ssh ${SERVER_USER}@${SERVER_IP} 'cd /opt/rebooked && docker-compose -f docker-compose.vps.yml restart'"
    echo ""
    echo "=== MONITORING ==="
    echo "Check logs: ssh ${SERVER_USER}@${SERVER_IP} 'cd /opt/rebooked && docker-compose -f docker-compose.vps.yml logs -f'"
    echo "Check status: ssh ${SERVER_USER}@${SERVER_IP} 'cd /opt/rebooked && docker-compose -f docker-compose.vps.yml ps'"
    echo "Backup: ssh ${SERVER_USER}@${SERVER_IP} '/opt/rebooked/backup.sh'"
    echo ""
    log "Deployment log saved to: ${LOG_FILE}"
}

# Main execution
main() {
    log "Starting VPS deployment for Rebooked"
    echo ""
    
    check_requirements
    create_env_template
    
    echo ""
    warning "Please edit .env.vps with your actual credentials before continuing"
    read -p "Press Enter to continue or Ctrl+C to exit..."
    
    if [ ! -f .env.vps ]; then
        error ".env.vps file not found"
    fi
    
    deploy_to_vps
    setup_ssl
    start_application
    health_check
    show_summary
    
    log "VPS deployment completed successfully! 🚀"
}

# Run main function
main "$@"
