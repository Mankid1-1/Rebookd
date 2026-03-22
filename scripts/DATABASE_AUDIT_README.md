# 🚀 REBOOKED DATABASE AUDIT & FIX SYSTEM

## 📋 **OVERVIEW**

Complete database health check and repair system for Rebooked. Ensures all databases are correct, optimized, and ready for smooth sailing.

### 🎯 **WHAT IT DOES**
- ✅ **Creates all required tables** with proper structure
- ✅ **Sets up foreign key constraints** for data integrity
- ✅ **Optimizes database performance** with proper indexing
- ✅ **Seeds initial data** (plans, default settings)
- ✅ **Verifies database health** with comprehensive checks
- ✅ **Cross-platform support** (Windows, Mac, Linux)

---

## 🚀 **QUICK START**

### 📦 **METHOD 1: NPM SCRIPT (Recommended)**
```bash
# Interactive database audit and fix
npm run db:audit

# Direct SQL execution (manual setup)
npm run db:fix
```

### 📦 **METHOD 2: NODE.JS SCRIPT**
```bash
# Run the Node.js audit script
node scripts/database-audit.js
```

### 📦 **METHOD 3: LINUX/MAC**
```bash
# Make script executable
chmod +x scripts/run-database-audit.sh

# Run audit script
./scripts/run-database-audit.sh
```

### 📦 **METHOD 4: WINDOWS**
```bash
# Run Windows batch file
scripts\run-database-audit.bat
```

### 📦 **METHOD 5: DIRECT SQL**
```bash
# Run SQL directly (requires MySQL client)
mysql -h localhost -u root -p rebooked < scripts/database-audit-fix.sql
```

---

## 📁 **FILES INCLUDED**

### 🎯 **MAIN SCRIPTS**
- ✅ **`database-audit-fix.sql`** - Complete SQL audit and fix script
- ✅ **`database-audit.js`** - Node.js cross-platform audit script
- ✅ **`run-database-audit.sh`** - Linux/Mac execution script
- ✅ **`run-database-audit.bat`** - Windows execution script

### 📚 **DOCUMENTATION**
- ✅ **`DATABASE_AUDIT_README.md`** - This comprehensive guide

---

## 🗄️ **DATABASE STRUCTURE CREATED**

### 🔐 **AUTHENTICATION TABLES**
```sql
users                    # User accounts and authentication
email_verification_tokens # Email verification tokens
password_reset_tokens    # Password reset tokens
```

### 🏢 **TENANT MANAGEMENT**
```sql
tenants                  # Multi-tenant organization data
plans                    # Subscription plans
subscriptions            # User subscriptions
billing_invoices         # Billing invoices
billing_refunds          # Billing refunds
usage                    # Usage tracking
```

### 📞 **PHONE & COMMUNICATION**
```sql
phone_numbers            # Tenant phone numbers
leads                    # Customer leads
messages                 # SMS messages
templates                # Message templates
automations              # Automation workflows
automation_jobs          # Automation job queue
```

### 🤖 **AI & SYSTEM**
```sql
ai_message_logs          # AI message rewriting logs
webhook_logs             # Webhook processing logs
api_keys                 # API key management
system_error_logs        # System error tracking
admin_audit_logs         # Admin action audit trail
```

### ⚡ **PERFORMANCE & MONITORING**
```sql
sms_rate_limits          # SMS rate limiting
llm_circuit_breakers     # LLM circuit breaker state
webhook_receive_dedupes # Webhook deduplication
auth_rate_limits         # Authentication rate limiting
```

---

## 🔧 **PREREQUISITES**

### 🖥️ **SYSTEM REQUIREMENTS**
- **MySQL 5.7+** or **MariaDB 10.2+**
- **Node.js 18+** (for Node.js script)
- **MySQL client** (for direct SQL execution)

### 📦 **NODE.JS DEPENDENCIES**
```bash
# Install mysql2 for Node.js script
npm install mysql2
```

### 🌐 **DATABASE PERMISSIONS**
- **CREATE** - Create database and tables
- **ALTER** - Modify table structure
- **INSERT** - Seed initial data
- **INDEX** - Create indexes for performance
- **REFERENCES** - Create foreign key constraints

---

## 🔄 **AUDIT PROCESS**

### 1️⃣ **DATABASE HEALTH CHECK**
- ✅ Checks database character set and collation
- ✅ Verifies table existence and structure
- ✅ Validates foreign key constraints
- ✅ Analyzes index performance

### 2️⃣ **TABLE CREATION & REPAIR**
- ✅ Creates missing tables with proper structure
- ✅ Adds missing columns and indexes
- ✅ Repairs damaged foreign key constraints
- ✅ Optimizes table engines and collations

### 3️⃣ **DATA INTEGRITY**
- ✅ Sets up foreign key relationships
- ✅ Creates unique constraints
- ✅ Adds performance indexes
- ✅ Validates data types and constraints

### 4️⃣ **INITIAL DATA SEEDING**
- ✅ Inserts default subscription plans
- ✅ Sets up system configurations
- ✅ Creates default admin settings
- ✅ Initializes rate limiting tables

### 5️⃣ **PERFORMANCE OPTIMIZATION**
- ✅ Sets optimal MySQL configuration
- ✅ Analyzes tables for query performance
- ✅ Configures InnoDB buffer pool
- ✅ Optimizes log file sizes

---

## 📊 **VERIFICATION RESULTS**

After running the audit, you'll see:

### ✅ **SUCCESS INDICATORS**
```
🎉 DATABASE AUDIT AND FIX COMPLETE!
=====================================
✅ Your Rebooked database is now optimized and ready for smooth sailing!

📊 DATABASE STATISTICS:
  Tables: 25
  Foreign Keys: 20
  Plans Seeded: 3
  Total Size (MB): 2.5
```

### 🔍 **HEALTH CHECKS PERFORMED**
- ✅ **25 tables created/verified**
- ✅ **20 foreign key constraints set up**
- ✅ **50+ performance indexes created**
- ✅ **3 subscription plans seeded**
- ✅ **UTF-8 character set configured**
- ✅ **InnoDB optimization applied**

---

## 🛠️ **TROUBLESHOOTING**

### ❌ **COMMON ISSUES**

#### **Connection Failed**
```bash
# Check MySQL service status
sudo systemctl status mysql  # Linux
brew services list | grep mysql  # Mac

# Start MySQL service
sudo systemctl start mysql  # Linux
brew services start mysql  # Mac
```

#### **Permission Denied**
```sql
-- Grant necessary permissions
GRANT ALL PRIVILEGES ON rebooked.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

#### **Foreign Key Errors**
```sql
-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;
-- Run your operations
SET FOREIGN_KEY_CHECKS = 1;
```

#### **Character Set Issues**
```sql
-- Fix character set problems
ALTER DATABASE rebooked CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 🔄 **MAINTENANCE & UPDATES**

### 📅 **REGULAR MAINTENANCE**
```bash
# Run audit after major updates
npm run db:audit

# Check database health
mysql -h localhost -u root -p -e "
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  DATA_LENGTH,
  INDEX_LENGTH
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'rebooked';
"
```

### 🔄 **DATABASE OPTIMIZATION**
```sql
-- Optimize tables periodically
OPTIMIZE TABLE users, tenants, leads, messages, automations;

-- Analyze tables for query optimizer
ANALYZE TABLE users, tenants, leads, messages, automations;

-- Check table health
CHECK TABLE users, tenants, leads, messages, automations;
```

---

## 🎯 **BEST PRACTICES**

### ✅ **BEFORE RUNNING AUDIT**
1. **Backup existing database**
2. **Test on staging environment first**
3. **Verify MySQL version compatibility**
4. **Check available disk space**

### ✅ **AFTER RUNNING AUDIT**
1. **Verify application functionality**
2. **Test all database operations**
3. **Monitor performance metrics**
4. **Check error logs**

### ✅ **PRODUCTION DEPLOYMENT**
1. **Run during maintenance window**
2. **Inform users of downtime**
3. **Monitor rollback plan**
4. **Document any customizations**

---

## 📞 **SUPPORT & HELP**

### 🔍 **DEBUGGING MODE**
```bash
# Enable verbose logging
DEBUG=mysql:* npm run db:audit

# Check SQL execution
mysql -h localhost -u root -p -v rebooked < scripts/database-audit-fix.sql
```

### 📋 **LOG FILES**
- **MySQL error log**: `/var/log/mysql/error.log`
- **MySQL slow query log**: `/var/log/mysql/mysql-slow.log`
- **Application logs**: `logs/database.log`

### 🆘 **GETTING HELP**
1. **Check this README first**
2. **Review error messages carefully**
3. **Test with a fresh database**
4. **Contact support with logs**

---

## 🎉 **SUCCESS CONFIRMATION**

When you see this output, your database is ready:

```
🎉 REBOOKED DATABASE AUDIT & FIX COMPLETE!
=====================================
✅ Your Rebooked database is now optimized and ready for smooth sailing!

📊 DATABASE STATISTICS:
  Tables: 25
  Foreign Keys: 20
  Plans Seeded: 3
  Total Size (MB): 2.5

Next steps:
1. Update your application's database connection string
2. Run your application migrations if needed
3. Test your application functionality

🌐 Your database is ready for production!
```

---

**🚀 Your Rebooked database audit and fix system is ready for smooth sailing!**
