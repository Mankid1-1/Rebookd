# 🚀 Rebooked Auto-Deployment Guide

## Overview

This comprehensive auto-deployment system handles the complete setup of Rebooked from a zip file to a production-ready Debian server with full stack configuration.

## 📋 Prerequisites

1. **Debian/Ubuntu Server** with sudo access
2. **rebooked.zip** file in the current directory
3. **Internet connection** for package downloads

## 🎯 Quick Start

### Option 1: Using npm (Recommended)
```bash
# Place rebooked.zip in the project root
sudo npm run deploy
```

### Option 2: Direct Script Execution
```bash
# Place rebooked.zip in the project root
sudo ./scripts/deploy.sh
```

## 🔧 What the Deployment Script Does

### ✅ **System Setup**
- ✅ Checks system requirements (Node.js, disk space, memory)
- ✅ Installs Node.js and npm if not present
- ✅ Validates Debian/Ubuntu environment

### 📦 **Application Setup**
- ✅ Extracts `rebooked.zip` to temporary directory
- ✅ Installs production dependencies with `npm ci`
- ✅ Sets up proper application structure
- ✅ Configures environment variables

### 🗄️ **Database Setup**
- ✅ Installs PostgreSQL server
- ✅ Creates database and user
- ✅ Runs database migrations
- ✅ Configures proper permissions

### 🔒 **SSL & Security**
- ✅ Installs Let's Encrypt with Certbot
- ✅ Generates SSL certificate for your domain
- ✅ Sets up auto-renewal cron job
- ✅ Configures UFW firewall rules

### 🌐 **Web Server Setup**
- ✅ Installs and configures Nginx
- ✅ Sets up reverse proxy for API
- ✅ Configures static file serving
- ✅ Adds security headers and gzip compression
- ✅ Implements rate limiting

### ⚙️ **Process Management**
- ✅ Creates systemd service file
- ✅ Enables auto-start on boot
- ✅ Configures proper logging
- ✅ Sets up log rotation

### 👤 **Admin Account**
- ✅ Creates default admin user account
- ✅ Generates secure password hash
- ✅ Provides access credentials

### 📊 **Monitoring**
- ✅ Sets up application logging
- ✅ Configures log rotation
- ✅ Creates monitoring directories
- ✅ Provides maintenance commands

## 🔧 Configuration Options

You can customize the deployment by setting environment variables:

```bash
export DB_HOST=localhost          # Database host
export DB_PORT=5432            # Database port
export DB_NAME=rebooked        # Database name
export DB_USER=rebooked_user    # Database user
export DB_PASSWORD=secure_pass   # Database password
export ADMIN_EMAIL=admin@domain  # Admin email
export ADMIN_PASSWORD=admin123    # Admin password
export DOMAIN=yourdomain.com     # Your domain
export SSL_EMAIL=admin@domain   # SSL certificate email
```

## 📁 File Structure After Deployment

```
/rebooked-app/                 # Main application directory
├── server/                   # Backend server files
├── dist-build/               # Built frontend files
├── node_modules/             # Dependencies
└── deployment-report.txt     # Access information
```

## 🔑 Access Information

After deployment, check `deployment-report.txt` for:

- **Admin Panel URL**: `https://yourdomain.com/admin`
- **API Endpoint**: `https://yourdomain.com/api`
- **Database Credentials**: Host, port, user, password
- **Admin Account**: Email and password for login

## 🛠️ Management Commands

### Application Management
```bash
# Check application status
sudo systemctl status rebooked

# Restart application
sudo systemctl restart rebooked

# View application logs
sudo journalctl -u rebooked -f

# Stop application
sudo systemctl stop rebooked
```

### Database Management
```bash
# Connect to database
psql -h localhost -U rebooked_user -d rebooked

# Backup database
pg_dump -h localhost -U rebooked_user rebooked > backup.sql

# Restore database
psql -h localhost -U rebooked_user -d rebooked < backup.sql
```

### SSL Certificate Management
```bash
# Check certificate status
sudo certbot certificates

# Manually renew certificate
sudo certbot renew

# Test certificate renewal
sudo certbot renew --dry-run
```

## 🔒 Security Recommendations

1. **Change Default Passwords**: Immediately change the default admin password
2. **Regular Backups**: Set up automated database backups
3. **Monitor SSL**: Check certificate renewal status
4. **Update System**: Keep packages updated with `apt update && apt upgrade`
5. **Review Logs**: Monitor application and system logs regularly

## 🚨 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>
```

**Database Connection Failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database logs
sudo tail -f /var/log/postgresql/postgresql.log
```

**SSL Certificate Issues**
```bash
# Check Nginx configuration
sudo nginx -t

# Check certificate files
sudo ls -la /etc/letsencrypt/live/yourdomain.com/
```

**Application Not Starting**
```bash
# Check systemd service status
sudo systemctl status rebooked

# View detailed error logs
sudo journalctl -u rebooked -n 50
```

## 🔄 Updates and Maintenance

### Updating Application
```bash
# Pull latest code
cd /path/to/rebooked-app
git pull origin main

# Install new dependencies
npm ci --production

# Restart application
sudo systemctl restart rebooked
```

### Regular Maintenance
```bash
# Monthly system updates
sudo apt update && sudo apt upgrade -y

# Weekly log cleanup
sudo find /var/log/rebooked -name "*.log" -mtime +30 -delete

# Check disk space monthly
df -h
```

## 📞 Support

If you encounter issues during deployment:

1. Check the deployment log output for specific error messages
2. Verify all prerequisites are met
3. Ensure you have proper sudo privileges
4. Check system resources (disk space, memory)
5. Review the troubleshooting section above

## 🎉 Success Indicators

Deployment is successful when you see:

```
🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!
📋 Check deployment-report.txt for access information
```

The application will be available at:
- **Admin Panel**: `https://yourdomain.com/admin`
- **Main Application**: `https://yourdomain.com`
- **API Documentation**: `https://yourdomain.com/api/docs`

---

**🚀 Your Rebooked application is now production-ready!**
