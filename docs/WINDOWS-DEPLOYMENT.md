# 🖥️ Rebooked Windows Deployment Guide

## Overview

This guide covers deploying Rebooked from a Windows development machine to a remote Linux server (Contabo, DigitalOcean, etc.).

## 📋 Prerequisites

### On Your Windows Machine:
1. **Node.js** (v18 or higher) installed
2. **Git** for Windows (optional, for SSH key management)
3. **SSH client** (built into Windows 10/11)
4. **rebooked.zip** file in project root

### On Your Remote Linux Server:
1. **Debian/Ubuntu** with sudo access
2. **SSH access** with password or key authentication
3. **Internet connection** for package downloads

## 🎯 Quick Start

### Option 1: Using npm (Recommended)
```cmd
# Place rebooked.zip in project root
npm run deploy:windows
```

### Option 2: Direct Script Execution
```cmd
# Place rebooked.zip in project root
scripts\deploy.bat
```

### Option 3: Direct Node.js Execution
```cmd
# Place rebooked.zip in project root
node scripts/auto-deploy-windows.js
```

## 🔧 Configuration Options

You can configure deployment by setting environment variables before running:

**Windows Command Prompt:**
```cmd
set REMOTE_HOST=your-server.com
set REMOTE_USER=root
set REMOTE_PATH=/root/rebooked
set DB_HOST=localhost
set ADMIN_EMAIL=admin@yourdomain.com
set ADMIN_PASSWORD=secure123
set DOMAIN=yourdomain.com
npm run deploy:windows
```

**PowerShell:**
```powershell
$env:REMOTE_HOST="your-server.com"
$env:REMOTE_USER="root"
$env:REMOTE_PATH="/root/rebooked"
$env:DB_HOST="localhost"
$env:ADMIN_EMAIL="admin@yourdomain.com"
$env:ADMIN_PASSWORD="secure123"
$env:DOMAIN="yourdomain.com"
npm run deploy:windows
```

## 🔑 SSH Authentication Setup

### Option 1: Password Authentication (Easier)
The script will prompt for your SSH password during deployment.

### Option 2: Key-based Authentication (Recommended)
1. **Generate SSH key on Windows:**
   ```cmd
   ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
   ```

2. **Copy public key to server:**
   ```cmd
   type C:\Users\YourUser\.ssh\id_rsa.pub | ssh user@server "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
   ```

3. **Test connection:**
   ```cmd
   ssh user@server
   ```

## 🚀 What the Windows Script Does

### ✅ **Local Preparation**
- ✅ Validates Windows environment (Node.js, zip file)
- ✅ Extracts `rebooked.zip` to temporary directory
- ✅ Prepares files for remote upload

### 📡 **Remote Deployment**
- ✅ Tests SSH connection to remote server
- ✅ Uploads deployment script and zip file to server
- ✅ Executes full Linux deployment on remote server
- ✅ Handles all Linux-specific commands remotely

### 🗄️ **Remote Server Setup** (via SSH)
- ✅ System requirements check (Linux commands)
- ✅ PostgreSQL installation and configuration
- ✅ SSL certificate setup with Let's Encrypt
- ✅ Nginx reverse proxy configuration
- ✅ Systemd service creation
- ✅ Firewall setup with UFW
- ✅ Admin account creation
- ✅ Monitoring and logging setup

## 📁 File Structure

### After Local Extraction:
```
/deploy-temp/              # Temporary extraction directory
├── server/              # Backend files
├── client/              # Frontend files
├── package.json         # Dependencies
└── ...                # Other project files
```

### On Remote Server:
```
/root/rebooked/           # Final application directory
├── rebooked-app/       # Extracted application
├── auto-deploy.js       # Deployment script
├── rebooked.zip        # Uploaded zip file
└── deployment-report.txt # Generated report
```

## 🔑 Access Information

After deployment, check `windows-deployment-report.txt` for:

- **Admin Panel URL**: `https://yourdomain.com/admin`
- **API Endpoint**: `https://yourdomain.com/api`
- **Database Credentials**: Connection details
- **Admin Account**: Login credentials
- **Remote Management**: SSH commands for server management

## 🛠️ Remote Management Commands

### Application Management (via SSH)
```bash
# Connect to server
ssh user@your-server.com

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

## 🚨 Troubleshooting Windows Issues

### SSH Connection Failed
```
❌ Remote connection test failed: Command failed
```

**Solutions:**
1. Verify server hostname/IP address
2. Check SSH service is running on server
3. Verify firewall allows SSH (port 22)
4. Test SSH manually: `ssh user@server`

### File Upload Failed
```
❌ File upload failed: Permission denied
```

**Solutions:**
1. Check SSH user has write permissions
2. Verify remote directory exists
3. Test manual upload: `scp file.zip user@server:/path/`

### Node.js Not Found
```
❌ Node.js is not installed
```

**Solutions:**
1. Download Node.js from https://nodejs.org/
2. Install and restart command prompt
3. Verify with: `node --version`

### ZIP File Not Found
```
❌ rebooked.zip not found in current directory
```

**Solutions:**
1. Ensure `rebooked.zip` is in project root
2. Check file name spelling
3. Verify file is not corrupted

## 🔄 Updates and Maintenance

### Updating Application
```cmd
# On Windows machine
cd /path/to/rebooked
git pull origin main
npm run deploy:windows
```

### Remote Server Maintenance
```bash
# Connect via SSH and run:
sudo apt update && sudo apt upgrade -y
sudo systemctl restart rebooked
```

## 🔒 Security Best Practices

### Windows Machine Security:
1. Keep Node.js updated
2. Use antivirus software
3. Secure SSH keys (don't share private keys)
4. Use Windows Defender or equivalent

### Remote Server Security:
1. Change default admin password immediately
2. Use SSH key authentication instead of passwords
3. Keep server updated regularly
4. Monitor access logs
5. Setup automated backups

## 📞 Support

If you encounter issues during deployment:

1. **Check the error message** in the deployment output
2. **Verify prerequisites** on both Windows and Linux
3. **Test SSH connection** manually first
4. **Review troubleshooting section** above
5. **Check server resources** (disk space, memory)

## 🎉 Success Indicators

Windows deployment is successful when you see:

```
🎉 WINDOWS DEPLOYMENT COMPLETED SUCCESSFULLY!
📋 Check windows-deployment-report.txt for access information
```

The application will be available at:
- **Admin Panel**: `https://yourdomain.com/admin`
- **Main Application**: `https://yourdomain.com`
- **API Documentation**: `https://yourdomain.com/api/docs`

---

**🖥️ Your Rebooked application is now production-ready on your Linux server!**
