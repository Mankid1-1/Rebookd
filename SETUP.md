# 🚀 **QUICK SETUP GUIDE**

## **Easiest Setup Options**

### **🎯 Option 1: Automated Setup (Recommended)**
```bash
node setup.js
```
This interactive script handles everything in one go!

### **⚡ Option 2: Windows Quick Start**
```bash
quick-start.bat
```
Double-click or run this batch file for Windows automation.

### **🔧 Option 3: Manual Setup**
```bash
# 1. Install dependencies
npm install

# 2. Configure database in .env file
# Edit DATABASE_URL to match your database

# 3. Start server
npm run dev
```

---

## **📋 What You Need**

### **Prerequisites:**
- ✅ Node.js (v18 or higher)
- ✅ MySQL/MariaDB database
- ✅ Database credentials

### **Database Connection Format:**
```
mysql://username:password@host:3306/database_name
```

**Examples:**
- Local: `mysql://root:@localhost:3306/rebooked`
- Remote: `mysql://user:pass@192.168.1.100:3306/rebooked`

---

## **🚀 After Setup**

**Server Access:**
- **URL**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API**: http://localhost:3000/api/trpc

**Common Commands:**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm test             # Run tests
npm run db:migrate   # Update database schema
```

---

## **🔍 Troubleshooting**

**"Database unreachable"** → Check DATABASE_URL in .env file
**"Port 3000 busy"** → Server will auto-switch to 3001
**"Dependencies missing"** → Run `npm install`

---

## **📞 Need Help?**

If you need assistance with database setup or have any issues, let me know your specific database configuration and I'll help you get connected!
