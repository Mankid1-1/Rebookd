# 🚀 SERVER DEPLOYMENT STRUCTURE GUIDE

## 📁 **DIRECTORY STRUCTURE FOR YOUR SERVER**

### 🌐 **public_html/** (Web-accessible files)
```
public_html/
├── assets/                          # All static assets from build
│   ├── index-CXJQXriD.css          # Main CSS bundle
│   ├── index-BcgRfaFo.js           # Main JavaScript bundle
│   ├── Dashboard-BUbe2ha7.js       # Dashboard component
│   ├── Leads-BRvIeGZl.js           # Leads management
│   ├── [All other JS/CSS assets]   # Remaining component bundles
│   └── [*.woff2, *.png, *.svg]     # Fonts and images
├── index.html                      # Main HTML entry point
└── [manifest.json, favicon.ico]   # Additional web assets
```

### 🔒 **private_html/** (Server-side files - NOT web-accessible)
```
private_html/
├── server/                         # Your Node.js backend
│   ├── _core/                      # Core application logic
│   ├── services/                   # Business logic services
│   ├── routes/                     # API endpoints
│   ├── middleware/                 # Express middleware
│   ├── worker.ts                   # Background job processor
│   └── app.ts                      # Express app entry point
├── dist/                           # Compiled server code
│   ├── index.js                    # Main server bundle
│   ├── worker.js                   # Worker process bundle
│   └── app.js                      # Production app bundle
├── drizzle/                        # Database migrations
│   ├── migrations/                 # SQL migration files
│   └── schema.ts                   # Database schema
├── scripts/                        # Utility scripts
│   ├── build.mjs                   # Build script
│   └── production-test.js          # Production testing
├── .env.production                 # Production environment variables
├── package.json                    # Dependencies
├── pnpm-lock.yaml                  # Lock file
├── ecosystem.config.js             # PM2 configuration
├── node_modules/                   # Dependencies
└── logs/                           # Application logs
    ├── access.log
    ├── error.log
    └── app.log
```

---

## 🚀 **DEPLOYMENT STEPS**

### 1️⃣ **PREPARE YOUR SERVER**

```bash
# SSH into your server
ssh user@your-server.com

# Create directory structure
mkdir -p /home/user/public_html
mkdir -p /home/user/private_html
mkdir -p /home/user/private_html/logs
```

### 2️⃣ **UPLOAD CLIENT FILES (public_html)**

```bash
# Upload built client assets to public_html
scp -r dist/public/* user@your-server.com:/home/user/public_html/

# Verify permissions
ssh user@your-server.com "chmod 755 /home/user/public_html"
ssh user@your-server.com "chmod -R 644 /home/user/public_html/*"
ssh user@your-server.com "chmod 755 /home/user/public_html/assets"
```

### 3️⃣ **UPLOAD SERVER FILES (private_html)**

```bash
# Upload server-side files
scp -r server/ user@your-server.com:/home/user/private_html/
scp -r dist/ user@your-server.com:/home/user/private_html/
scp -r drizzle/ user@your-server.com:/home/user/private_html/
scp -r scripts/ user@your-server.com:/home/user/private_html/
scp package.json user@your-server.com:/home/user/private_html/
scp pnpm-lock.yaml user@your-server.com:/home/user/private_html/
scp ecosystem.config.js user@your-server.com:/home/user/private_html/

# Upload production environment (SECURE!)
scp .env.production user@your-server.com:/home/user/private_html/.env
```

### 4️⃣ **INSTALL DEPENDENCIES ON SERVER**

```bash
ssh user@your-server.com

cd /home/user/private_html

# Install dependencies
npm install -g pnpm
pnpm install --production

# Set up database
pnpm db:migrate
pnpm db:seed:all
```

### 5️⃣ **CONFIGURE PM2**

```bash
# Start with PM2
pnpm pm2:start

# Save PM2 configuration
pm2 save
pm2 startup
```

---

## 🌐 **NGINX CONFIGURATION**

Create `/etc/nginx/sites-available/rebooked`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Client files (public_html)
    root /home/user/public_html;
    index index.html;
    
    # Handle client routing (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy to server
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
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable and restart nginx:

```bash
sudo ln -s /etc/nginx/sites-available/rebooked /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 **SECURITY CONFIGURATION**

### 1️⃣ **FILE PERMISSIONS**

```bash
# Secure private_html (no web access)
chmod 750 /home/user/private_html

# Secure environment file
chmod 600 /home/user/private_html/.env

# Secure logs directory
chmod 750 /home/user/private_html/logs
```

### 2️⃣ **FIREWALL RULES**

```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 3️⃣ **SSL CERTIFICATE**

```bash
# Install SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 📁 **EXACT FILES TO UPLOAD**

### 🌐 **public_html/ (23 files)**
```
✅ index.html
✅ assets/index-CXJQXriD.css
✅ assets/index-BcgRfaFo.js
✅ assets/Dashboard-BUbe2ha7.js
✅ assets/Leads-BRvIeGZl.js
✅ assets/[All 40+ JS/CSS asset files]
```

### 🔒 **private_html/ (Core files)**
```
✅ server/ (entire directory)
✅ dist/index.js
✅ dist/worker.js
✅ dist/app.js
✅ drizzle/ (entire directory)
✅ scripts/ (entire directory)
✅ package.json
✅ pnpm-lock.yaml
✅ ecosystem.config.js
✅ .env (renamed from .env.production)
```

---

## 🚀 **FINAL VERIFICATION**

### 1️⃣ **TEST CLIENT ACCESS**
```bash
curl -I http://your-domain.com
# Should return 200 OK with HTML content
```

### 2️⃣ **TEST API ENDPOINTS**
```bash
curl -I http://your-domain.com/api/health
# Should return API response from server
```

### 3️⃣ **CHECK PM2 STATUS**
```bash
pm2 status
pm2 logs
```

### 4️⃣ **VERIFY DATABASE**
```bash
cd /home/user/private_html
pnpm db:push
```

---

## 🎯 **QUICK DEPLOYMENT CHECKLIST**

- [ ] Upload all client assets to `public_html/`
- [ ] Upload server files to `private_html/`
- [ ] Set correct file permissions
- [ ] Install dependencies with `pnpm install`
- [ ] Configure and start PM2
- [ ] Set up nginx reverse proxy
- [ ] Install SSL certificate
- [ ] Test all endpoints
- [ ] Verify database connection
- [ ] Check application logs

---

**🚀 Your application will be live and production-ready with this structure!**
