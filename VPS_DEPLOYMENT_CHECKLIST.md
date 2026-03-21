# 🚀 VPS Deployment Checklist

## 📋 Server Information
- **IP Address**: 173.249.56.141
- **Domain**: rebooked.org
- **Temporary URL**: http://173.249.56.141/~rebooked
- **SSH Access**: root@173.249.56.141

## 🎯 Pre-Deployment Checklist

### **✅ Local Preparation**
- [ ] Application built successfully (`npm run build`)
- [ ] All tests passing (`npm test`)
- [ ] TypeScript compilation clean (`npm run check`)
- [ ] Environment template created (`.env.vps.example`)
- [ ] Deployment scripts ready (`deploy-vps.ps1` or `deploy-vps.sh`)
- [ ] Docker Compose VPS configuration ready (`docker-compose.vps.yml`)
- [ ] Nginx configuration prepared (`nginx/rebooked.conf`)

### **✅ Server Requirements**
- [ ] SSH access to server confirmed
- [ ] Domain DNS configured (ns1.server-173-249-56-141.da.direct, ns2.server-173-249-56-141.da.direct)
- [ ] Email accounts created in hosting panel
- [ ] SSL certificate ready (or will be auto-generated)

### **✅ Service Credentials**
- [ ] MySQL database credentials ready
- [ ] JWT secret generated
- [ ] Encryption key generated
- [ ] Email SMTP/POP3 credentials ready
- [ ] SMS provider API keys ready
- [ ] Stripe keys ready
- [ ] OpenAI API key ready
- [ ] Sentry DSN ready (optional)

---

## 🔧 Deployment Steps

### **1. Environment Configuration**
```bash
# Copy environment template
cp .env.vps.example .env.vps

# Edit with actual credentials
notepad .env.vps  # Windows
# or
nano .env.vps     # Linux/Mac
```

### **2. Run Deployment Script**

#### **Windows PowerShell**
```powershell
# Run deployment script
.\deploy-vps.ps1

# Or with custom parameters
.\deploy-vps.ps1 -ServerIP "173.249.56.141" -Domain "rebooked.org"
```

#### **Linux/Mac Bash**
```bash
# Make script executable
chmod +x deploy-vps.sh

# Run deployment
./deploy-vps.sh
```

### **3. Monitor Deployment**
```bash
# SSH into server
ssh root@173.249.56.141

# Check application status
cd /opt/rebooked
docker-compose -f docker-compose.vps.yml ps

# View logs
docker-compose -f docker-compose.vps.yml logs -f

# Check specific service logs
docker-compose -f docker-compose.vps.yml logs app
docker-compose -f docker-compose.vps.yml logs worker
docker-compose -f docker-compose.vps.yml logs db
```

---

## 🧪 Post-Deployment Verification

### **✅ Health Checks**
```bash
# Test health endpoint
curl http://173.249.56.141/~rebooked/health

# Test ready endpoint
curl http://173.249.56.141/~rebooked/ready

# Expected response: {"status":"ok","db":"connected","uptime":123,"ts":"2024-..."}
```

### **✅ Application Access**
- [ ] Main application loads: http://173.249.56.141/~rebooked
- [ ] Admin panel accessible: http://173.249.56.141/~rebooked/admin
- [ ] API endpoints responding: http://173.249.56.141/~rebooked/api/trpc/health.status
- [ ] Static assets loading correctly

### **✅ Database Connection**
- [ ] Database accessible from application
- [ ] Tables created successfully
- [ ] Seed data applied (if any)
- [ ] Connection pooling working

### **✅ Email Integration**
- [ ] SMTP connection to mail.rebooked.org working
- [ ] POP3 connection to mail.rebooked.org working
- [ ] Test email sending successful
- [ ] Email processing worker running

### **✅ SMS Integration**
- [ ] Telnyx API connection working (if configured)
- [ ] Twilio API connection working (if configured)
- [ ] Test SMS sending successful
- [ ] SMS webhooks accessible

### **✅ Security Features**
- [ ] HTTPS redirect working
- [ ] SSL certificate installed and valid
- [ ] Security headers present
- [ ] Rate limiting active
- [ ] CORS configured correctly

---

## 🔍 Troubleshooting Guide

### **Common Issues**

#### **Application Not Starting**
```bash
# Check logs
docker-compose -f docker-compose.vps.yml logs app

# Common fixes:
# - Check environment variables in .env.vps
# - Verify database connection
# - Check port conflicts
```

#### **Database Connection Issues**
```bash
# Check database status
docker-compose -f docker-compose.vps.yml logs db

# Test database connection
mysql -h localhost -u rebooked -p rebooked

# Common fixes:
# - Verify database credentials
# - Check if database is running
# - Verify network connectivity
```

#### **SSL Certificate Issues**
```bash
# Check SSL status
certbot certificates

# Regenerate SSL certificate
certbot --nginx -d rebooked.org -d www.rebooked.org --force-renewal

# Common fixes:
# - Wait for DNS propagation
# - Check domain points to correct IP
# - Verify nginx configuration
```

#### **Email Issues**
```bash
# Test SMTP connection
telnet mail.rebooked.org 587

# Test POP3 connection
telnet mail.rebooked.org 995

# Common fixes:
# - Verify email account credentials
# - Check email account exists
# - Verify firewall allows connections
```

---

## 📊 Performance Monitoring

### **System Monitoring**
```bash
# Check system resources
htop
df -h
free -m
iostat

# Check Docker resource usage
docker stats
```

### **Application Monitoring**
```bash
# Check application logs
tail -f /opt/rebooked/logs/app-error.log
tail -f /opt/rebooked/logs/worker-error.log

# Check nginx logs
tail -f /var/log/nginx/rebooked_access.log
tail -f /var/log/nginx/rebooked_error.log
```

### **Database Monitoring**
```bash
# Check MySQL status
mysql -u root -p -e "SHOW PROCESSLIST;"
mysql -u root -p -e "SHOW STATUS;"

# Check slow queries
mysql -u root -p -e "SHOW SLOW LOGS;"
```

---

## 🔄 Maintenance Tasks

### **Daily**
- [ ] Check application health
- [ ] Review error logs
- [ ] Monitor system resources
- [ ] Check backup completion

### **Weekly**
- [ ] Update system packages
- [ ] Review SSL certificate expiry
- [ ] Check log file sizes
- [ ] Monitor database performance

### **Monthly**
- [ ] Rotate secrets (if needed)
- [ ] Review backup retention
- [ ] Update application version
- [ ] Security audit

---

## 📞 Support Contacts

### **Server Issues**
- **VPS Provider**: Your hosting provider
- **Domain Issues**: Domain registrar
- **DNS Issues**: DNS provider

### **Application Issues**
- **Application Logs**: `/opt/rebooked/logs/`
- **Database Issues**: MySQL logs
- **Email Issues**: Email provider support

---

## 🎯 Go Live Checklist

### **✅ Final Verification**
- [ ] All health checks passing
- [ ] SSL certificate valid
- [ ] Email sending/receiving working
- [ ] SMS sending working
- [ ] Database backups configured
- [ ] Monitoring setup
- [ ] Security measures in place

### **✅ DNS Configuration**
- [ ] A record: rebooked.org → 173.249.56.141
- [ ] A record: www.rebooked.org → 173.249.56.141
- [ ] MX record: mail.rebooked.org → 173.249.56.141
- [ ] Nameservers: ns1.server-173-249-56-141.da.direct, ns2.server-173-249-56-141.da.direct

### **✅ Production URLs**
- **Main Application**: https://rebooked.org
- **Admin Panel**: https://rebooked.org/admin
- **API**: https://rebooked.org/api/trpc
- **Health Check**: https://rebooked.org/health

---

## 🚀 Launch!

Once all checks are complete, your Rebooked application will be live at:

**https://rebooked.org**

### **Access Points**
- **Users**: https://rebooked.org
- **Admin**: https://rebooked.org/admin
- **API**: https://rebooked.org/api/trpc
- **Health**: https://rebooked.org/health

### **Next Steps**
1. **Monitor** the application for the first 24 hours
2. **Test** all major features
3. **Verify** email and SMS functionality
4. **Set up** monitoring alerts
5. **Document** any custom configurations

---

**🎉 Congratulations! Your Rebooked application is now deployed on your VPS!**
