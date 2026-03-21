# 🗄️ **Database Connection Guide**

## 📋 **Configure Your Server Database Connection**

To connect the application to your server's database, you need to update the `DATABASE_URL` in your `.env` file.

---

## 🔧 **Step-by-Step Configuration**

### **1. Create/Update Your .env File**
If you don't have a `.env` file, copy the example:
```bash
cp .env.example .env
```

### **2. Update Database URL**
Edit the `.env` file and update the `DATABASE_URL` line:

**Current (local):**
```
DATABASE_URL=mysql://root:password@localhost:3306/rebooked
```

**Replace with your server's database connection:**
```
DATABASE_URL=mysql://username:password@your-server-host:3306/database_name
```

### **3. Database Connection Format**
The `DATABASE_URL` follows this format:
```
mysql://[username]:[password]@[host]:[port]/[database_name]
```

**Examples:**
- **Local MySQL**: `mysql://root:myPassword@localhost:3306/rebooked`
- **Remote Server**: `mysql://dbuser:dbpass123@192.168.1.100:3306/rebooked`
- **Cloud Database**: `mysql://user:pass@mysql.example.com:3306/rebooked`

---

## 🔍 **Required Information**

You'll need from your server/database:

### **Database Credentials:**
- **Username**: Database user (e.g., `root`, `rebooked_user`)
- **Password**: Database password
- **Host**: Server IP or domain (e.g., `localhost`, `192.168.1.100`, `db.example.com`)
- **Port**: MySQL port (usually `3306`)
- **Database Name**: Database name (e.g., `rebooked`)

### **Common Server Setups:**

#### **XAMPP/MAMP/WAMP (Local):**
```
DATABASE_URL=mysql://root:password@localhost:3306/rebooked
```

#### **Remote MySQL Server:**
```
DATABASE_URL=mysql://rebooked_user:yourPassword@192.168.1.100:3306/rebooked
```

#### **Cloud Database (Railway/PlanetScale):**
```
DATABASE_URL=mysql://user:pass@host.railway.app:3306/rebooked
```

---

## 🚀 **After Configuration**

### **1. Restart the Server**
The server will automatically reconnect to the new database:
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### **2. Run Database Migrations**
If this is a fresh database connection:
```bash
npm run db:migrate
```

### **3. Verify Connection**
Check the health endpoint:
```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "ok",
  "db": "connected",
  "uptime": 123,
  "ts": "2026-03-21T22:20:00.000Z"
}
```

---

## 🔧 **Troubleshooting**

### **Common Issues:**

#### **"Database unreachable"**
- ✅ Check if database server is running
- ✅ Verify host and port are correct
- ✅ Confirm username/password are valid
- ✅ Ensure database exists

#### **"Access denied"**
- ✅ Verify user has permissions for the database
- ✅ Check if user can connect from your IP
- ✅ Confirm password is correct

#### **"Can't connect to MySQL server"**
- ✅ Check firewall settings
- ✅ Verify MySQL is running on the server
- ✅ Confirm port 3306 is open

---

## 🛡️ **Security Notes**

### **For Production:**
- ✅ Use a dedicated database user (not root)
- ✅ Use strong passwords
- ✅ Limit database user permissions
- ✅ Use SSL/TLS connections if available
- ✅ Keep database credentials secure

### **Environment Variables:**
- ✅ Never commit `.env` to version control
- ✅ Use different credentials for dev/prod
- ✅ Rotate passwords regularly

---

## 🎯 **Quick Setup Template**

Copy this template and replace the values:

```env
# Database Configuration
DATABASE_URL=mysql://YOUR_USERNAME:YOUR_PASSWORD@YOUR_HOST:3306/rebooked

# Example for local XAMPP:
# DATABASE_URL=mysql://root:@localhost:3306/rebooked

# Example for remote server:
# DATABASE_URL=mysql://rebooked_user:SecurePass123@192.168.1.100:3306/rebooked

# Example for cloud database:
# DATABASE_URL=mysql://user:pass@mysql.railway.app:3306/rebooked
```

---

## 🚀 **Need Help?**

If you need assistance with:
- **Finding your database credentials**
- **Setting up database permissions**
- **Configuring remote connections**
- **Troubleshooting connection issues**

Let me know your specific setup and I can provide more targeted guidance!
