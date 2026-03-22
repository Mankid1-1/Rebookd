# 🚀 REBOOKED SERVER SETUP SCRIPTS

## 📋 **OVERVIEW**

Complete automated setup system for deploying Rebooked from a zip file. The scripts will:
- ✅ Organize files into proper directory structure
- ✅ Respect existing folders (public_html, private_html, logs, stats)
- ✅ Install dependencies and configure environment
- ✅ Set up database and run migrations
- ✅ Configure PM2 for process management
- ✅ Generate nginx configuration
- ✅ Start the application automatically

---

## 🚀 **QUICK START**

### 📦 **METHOD 1: PACKAGE.JSON SCRIPT**
```bash
# Navigate to your project directory
cd /path/to/your/server

# Run setup with zip file
npm run setup rebooked-project.zip
```

### 📦 **METHOD 2: DIRECT NODE SCRIPT**
```bash
# Navigate to scripts directory
cd /path/to/your/project/scripts

# Run setup script
node server-setup.js ../rebooked-project.zip
```

### 📦 **METHOD 3: LINUX/MAC QUICK SETUP**
```bash
# Make script executable
chmod +x scripts/quick-setup.sh

# Run quick setup
./scripts/quick-setup.sh rebooked-project.zip
```

### 📦 **METHOD 4: WINDOWS SETUP**
```bash
# Run Windows batch file
scripts\setup.bat rebooked-project.zip
```

---

## 📁 **DIRECTORY STRUCTURE**

The script creates/organizes this structure:

```
your-server/
├── public_html/              # Web-accessible files
│   ├── index.html           # Main HTML entry point
│   ├── assets/              # CSS, JS, images
│   └── [static assets]
├── private_html/             # Server-side files (secure)
│   ├── server/              # Node.js backend
│   ├── dist/                # Compiled server code
│   ├── drizzle/             # Database migrations
│   ├── scripts/             # Utility scripts
│   ├── package.json         # Dependencies
│   ├── ecosystem.config.js  # PM2 configuration
│   └── .env                 # Environment variables
├── logs/                    # Application logs
├── stats/                   # Usage statistics
└── backup/                  # Automatic backups
```

---

## ⚙️ **SYSTEM REQUIREMENTS**

### 🖥️ **NODE.JS**
```bash
# Install Node.js 18+ (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 📦 **GLOBAL DEPENDENCIES**
```bash
# Install pnpm and PM2
npm install -g pnpm pm2
```

### 🌐 **WEB SERVER**
```bash
# Ubuntu/Debian
sudo apt-get install nginx certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install nginx certbot python3-certbot-nginx

# macOS
brew install nginx certbot
```

---

## 🔄 **SETUP PROCESS**

### 1️⃣ **PRE-SETUP**
- ✅ Checks existing folders (public_html, private_html, logs, stats)
- ✅ Creates automatic backup of existing files
- ✅ Validates zip file structure

### 2️⃣ **FILE ORGANIZATION**
- ✅ Extracts zip file to temporary directory
- ✅ Moves client files to `public_html/`
- ✅ Moves server files to `private_html/`
- ✅ Copies configuration files
- ✅ Preserves existing folder contents

### 3️⃣ **ENVIRONMENT SETUP**
- ✅ Installs Node.js dependencies
- ✅ Sets up environment file from example
- ✅ Configures production settings

### 4️⃣ **DATABASE SETUP**
- ✅ Runs database migrations
- ✅ Seeds initial data
- ✅ Validates database connection

### 5️⃣ **PROCESS MANAGEMENT**
- ✅ Configures PM2
- ✅ Starts application processes
- ✅ Sets up auto-restart on boot

### 6️⃣ **WEB SERVER**
- ✅ Generates nginx configuration
- ✅ Sets up reverse proxy
- ✅ Configures static asset serving

### 7️⃣ **VERIFICATION**
- ✅ Tests file structure
- ✅ Validates running processes
- ✅ Checks application health

---

## 🛠️ **MANUAL CONFIGURATION**

### 🔧 **ENVIRONMENT VARIABLES**
Edit `private_html/.env`:
```env
DATABASE_URL=mysql://user:password@localhost:3306/rebooked
STRIPE_SECRET_KEY=sk_test_...
TELNYX_API_KEY=...
TWILIO_ACCOUNT_SID=...
JWT_SECRET=your-jwt-secret
NODE_ENV=production
```

### 🌐 **NGINX SETUP**
```bash
# Copy generated config
sudo cp nginx-rebooked.conf /etc/nginx/sites-available/

# Enable site
sudo ln -s /etc/nginx/sites-available/nginx-rebooked.conf /etc/nginx/sites-enabled/

# Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

### 🔒 **SSL CERTIFICATE**
```bash
# Install SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 📊 **MONITORING & MANAGEMENT**

### 🚀 **PM2 COMMANDS**
```bash
# Check status
pm2 status

# View logs
pm2 logs

# Restart application
pm2 restart all

# Stop application
pm2 stop all

# Monitor performance
pm2 monit
```

### 📋 **APPLICATION LOGS**
```bash
# View application logs
tail -f logs/app.log

# View error logs
tail -f logs/error.log

# View access logs
tail -f logs/access.log
```

---

## 🔧 **TROUBLESHOOTING**

### ❌ **COMMON ISSUES**

#### **Permission Errors**
```bash
# Fix file permissions
sudo chown -R $USER:$USER public_html private_html logs stats
chmod 755 public_html private_html
chmod 644 public_html/* private_html/*
```

#### **Database Connection**
```bash
# Check database status
cd private_html
pnpm db:migrate

# Test connection
pnpm db:push
```

#### **PM2 Issues**
```bash
# Reset PM2
pm2 delete all
pnpm pm2:start
pm2 save
```

#### **Nginx Issues**
```bash
# Check nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# View nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 **UPDATES & MAINTENANCE**

### 📦 **UPDATING APPLICATION**
```bash
# Create backup
npm run setup updated-rebooked-project.zip

# The script will automatically:
# 1. Backup existing files
# 2. Update application
# 3. Restart services
# 4. Verify functionality
```

### 🗄️ **DATABASE MAINTENANCE**
```bash
cd private_html

# Run migrations
pnpm db:migrate

# Backup database
pnpm db:backup

# Seed data
pnpm db:seed:all
```

---

## 🎯 **BEST PRACTICES**

### ✅ **SECURITY**
- Keep environment variables secure
- Use HTTPS in production
- Regularly update dependencies
- Monitor application logs

### ✅ **PERFORMANCE**
- Enable static asset caching
- Use PM2 cluster mode for high traffic
- Monitor memory usage
- Regular database optimization

### ✅ **BACKUPS**
- Regular database backups
- File system backups
- Configuration backups
- Disaster recovery plan

---

## 📞 **SUPPORT**

If you encounter issues:

1. **Check logs**: `logs/app.log` and `logs/error.log`
2. **Verify configuration**: Environment variables and nginx config
3. **Test manually**: Run commands individually to isolate issues
4. **Check dependencies**: Ensure all required software is installed

---

**🚀 Your Rebooked application will be fully functional after running this setup script!**
