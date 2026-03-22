# 🚀 **Complete Backend Setup Guide**

## **🎯 One-Command Setup**

Run this single command to configure the entire backend:

```bash
node backend-setup.js
```

This interactive script handles **ALL** backend services and communications!

---

## **📋 What Gets Configured**

### **🗄️ Database**
- MySQL/MariaDB connection
- Database schema migrations
- Connection pooling and timeouts

### **🔐 Authentication & Security**
- JWT secret generation
- OAuth configuration
- Encryption keys for PII
- Webhook secrets

### **📱 SMS Communications**
- **Telnyx** (recommended) or **Twilio**
- API keys and phone numbers
- Rate limiting and compliance

### **📧 Email Services**
- **SendGrid** (recommended) or **SMTP**
- From addresses and templates
- POP3 inbound email

### **💳 Billing (Optional)**
- Stripe integration
- Webhook handling
- Subscription management

### **📊 Observability**
- Sentry error tracking
- Health endpoints
- Monitoring setup

---

## **🎯 Setup Options**

When you run `node backend-setup.js`, you'll see:

```
🎯 Backend Setup Options:
1. Complete backend setup (all services)
2. Database only
3. Communications only (SMS/Email)
4. Security only
5. Test current configuration
```

**Choose option 1 for complete setup!**

---

## **🔧 What You'll Need**

### **Required:**
- Database credentials (host, user, password, database name)

### **Optional (skip if not needed):**
- **SMS**: Telnyx or Twilio API keys
- **Email**: SendGrid API key or SMTP details
- **Billing**: Stripe keys
- **Monitoring**: Sentry DSN

---

## **🚀 After Setup**

**Start the server:**
```bash
npm run dev
```

**Test everything:**
```bash
# Health check
curl http://localhost:3000/health

# Ready check
curl http://localhost:3000/ready
```

**Access points:**
- **Main App**: http://localhost:3000
- **API**: http://localhost:3000/api/trpc
- **Health**: http://localhost:3000/health

---

## **📱 SMS Setup Details**

### **Telnyx (Recommended)**
1. Sign up at [telnyx.com](https://telnyx.com)
2. Get API key from Mission Control
3. Purchase a phone number
4. Configure inbound webhook: `https://yourdomain.com/api/sms/inbound`

### **Twilio**
1. Sign up at [twilio.com](https://twilio.com)
2. Get Account SID and Auth Token
3. Purchase a phone number
4. Configure webhook: `https://yourdomain.com/api/twilio/inbound`

---

## **📧 Email Setup Details**

### **SendGrid (Recommended)**
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Get API key
3. Verify sender domain
4. Set up from address

### **SMTP (Custom)**
1. Configure your mail server
2. Set up SMTP credentials
3. Configure inbound POP3 for processing

---

## **🔒 Security Features**

The setup automatically configures:
- **32-byte JWT secrets** for authentication
- **32-byte encryption keys** for PII protection
- **Webhook secrets** for secure integrations
- **Rate limiting** and abuse prevention

---

## **⚡ Quick Start Commands**

```bash
# Complete setup (recommended)
node backend-setup.js

# Database only
node backend-setup.js
# Choose option 2

# Communications only
node backend-setup.js
# Choose option 3

# Test current setup
node backend-setup.js
# Choose option 5
```

---

## **🛠️ Manual Configuration**

If you prefer manual setup, edit `.env` file:

```env
# Database
DATABASE_URL=mysql://user:pass@host:3306/rebooked

# Auth
JWT_SECRET=your-32-byte-secret
APP_URL=http://localhost:3000

# SMS (Telnyx)
TELNYX_API_KEY=your_api_key
TELNYX_FROM_NUMBER=+15550000000

# Email (SendGrid)
SENDGRID_API_KEY=your_api_key
EMAIL_FROM_ADDRESS=hello@rebooked.com

# Security
ENCRYPTION_KEY=your-32-byte-hex-key
WEBHOOK_SECRET=your-webhook-secret
```

---

## **🎉 Ready to Launch!**

After running the setup script, your backend will have:
- ✅ Database connected and migrated
- ✅ All communication channels configured
- ✅ Security properly implemented
- ✅ Monitoring and health checks ready
- ✅ Production-ready configuration

**The entire backend will be ready for real-world deployment!** 🚀
