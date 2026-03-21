# 📧 Email Setup Guide for Rebooked

## 🎯 Overview

This guide covers setting up SMTP and POP3 email integration with your `mail.rebooked.org` server for the Rebooked application.

---

## 📋 Server Details

```
IP: 173.249.56.141
POP Server: mail.rebooked.org
SMTP Server: mail.rebooked.org
```

### **Available Email Accounts**
- **POP Email Accounts**: 10
- **Email Forwarders**: 10  
- **Email Autoresponders**: 10
- **Email Mailing Lists**: 2

---

## 🔧 Configuration Steps

### **1. Environment Variables**

Add these to your `.env` file:

```bash
# ─── Email Configuration ──────────────────────────────────────
# SMTP (outgoing emails) - local mail.rebooked.org server
SMTP_HOST=mail.rebooked.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@rebooked.org
SMTP_PASS=your_smtp_password

# POP3 (incoming email processing) - local mail.rebooked.org server
POP3_HOST=mail.rebooked.org
POP3_PORT=995
POP3_TLS=true
POP3_USER=noreply@rebooked.org
POP3_PASSWORD=your_pop3_password

# Email settings
EMAIL_FROM_ADDRESS=noreply@rebooked.org

# Optional: SendGrid fallback
# SENDGRID_API_KEY=SG.xxxxx
```

### **2. Email Account Setup**

#### **Create Email Accounts**
1. Log into your hosting control panel (cPanel/Plesk)
2. Navigate to "Email Accounts"
3. Create these accounts:
   - `noreply@rebooked.org` (for system emails)
   - `info@rebooked.org` (for general inquiries)
   - `support@rebooked.org` (for customer support)

#### **Configure SMTP Settings**
- **Server**: `mail.rebooked.org`
- **Port**: `587` (with STARTTLS)
- **Authentication**: Required
- **Username**: Full email address (e.g., `noreply@rebooked.org`)
- **Password**: Your email account password

#### **Configure POP3 Settings**
- **Server**: `mail.rebooked.org`
- **Port**: `995` (SSL/TLS)
- **Authentication**: Required
- **Username**: Full email address (e.g., `noreply@rebooked.org`)
- **Password**: Your email account password

---

## 🚀 Features Enabled

### **✅ Outgoing Email (SMTP)**
- **Welcome Emails**: Automatic for new leads
- **Appointment Confirmations**: When appointments are scheduled
- **Follow-up Emails**: Automated follow-up sequences
- **System Notifications**: Admin alerts and reports
- **Password Resets**: User authentication emails

### **✅ Incoming Email (POP3)**
- **Lead Creation**: Automatically creates leads from incoming emails
- **Phone Number Extraction**: Extracts phone numbers from email content
- **Communication Logging**: Records all email communications
- **Duplicate Prevention**: Avoids creating duplicate leads
- **Auto-deletion**: Removes processed emails from server

### **✅ Email Processing**
- **Real-time Processing**: Worker checks emails every minute
- **Smart Parsing**: Extracts names and phone numbers from emails
- **Multiple Formats**: Supports various phone number formats
- **Error Handling**: Graceful failure with detailed logging
- **Audit Trail**: Complete logging of all email activities

---

## 🔄 Email Processing Flow

### **Incoming Emails**
```
1. POP3 connects to mail.rebooked.org:995
2. Retrieves all unread emails
3. Parses email content (subject, body, headers)
4. Extracts phone numbers using regex patterns
5. Extracts names from email headers/subject
6. Creates new leads if phone numbers found
7. Logs communication in messages table
8. Deletes processed emails from server
```

### **Outgoing Emails**
```
1. Uses SMTP server (mail.rebooked.org:587)
2. Falls back to SendGrid if SMTP fails
3. Sends HTML and text versions
4. Logs delivery status
5. Handles bouncebacks and failures
```

---

## 📊 Email Templates

### **Welcome Email**
- **Trigger**: New lead creation
- **Content**: Welcome message with company info
- **Personalization**: Lead name and tenant branding

### **Appointment Confirmation**
- **Trigger**: Appointment scheduled
- **Content**: Date, time, and preparation details
- **Personalization**: Lead name and appointment details

### **Follow-up Email**
- **Trigger**: Automated follow-up sequences
- **Content**: Custom follow-up messages
- **Personalization**: Lead name and custom message

---

## 🛠️ Testing Configuration

### **Test SMTP Connection**
```bash
# Using the API
curl -X POST http://localhost:3000/api/trpc/admin.email.test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Using the worker logs
tail -f logs/worker.log | grep "Email"
```

### **Test POP3 Connection**
```bash
# Manual test with telnet
telnet mail.rebooked.org 995

# Check email processing
curl -X GET http://localhost:3000/api/trpc/admin.email.status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### **Send Test Email**
```bash
curl -X POST http://localhost:3000/api/trpc/admin.email.send \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "text": "This is a test email from Rebooked",
    "html": "<h1>Test Email</h1><p>This is a test email from Rebooked</p>"
  }'
```

---

## 📈 Monitoring & Logs

### **Email Status Dashboard**
- **Configuration Status**: SMTP/POP3 connectivity
- **Test Results**: Connection and delivery tests
- **Processing Stats**: Emails processed per hour
- **Error Tracking**: Failed deliveries and retries

### **Log Locations**
- **Worker Logs**: Email processing activities
- **Application Logs**: SMTP/POP3 connection status
- **Admin Audit**: Email configuration changes
- **System Logs**: General email service status

### **Key Metrics**
- **Emails Processed**: Count of incoming emails
- **Leads Created**: New leads from email processing
- **Delivery Rate**: Success rate for outgoing emails
- **Response Time**: Average email processing time

---

## 🔍 Troubleshooting

### **Common Issues**

#### **SMTP Connection Failed**
```bash
# Check credentials
SMTP_USER=noreply@rebooked.org
SMTP_PASS=correct_password

# Verify server settings
SMTP_HOST=mail.rebooked.org
SMTP_PORT=587
SMTP_SECURE=false
```

#### **POP3 Connection Failed**
```bash
# Check credentials
POP3_USER=noreply@rebooked.org
POP3_PASSWORD=correct_password

# Verify server settings
POP3_HOST=mail.rebooked.org
POP3_PORT=995
POP3_TLS=true
```

#### **No Emails Being Processed**
```bash
# Check worker status
curl http://localhost:3000/ready

# Check POP3 mailbox
# Log into webmail at mail.rebooked.org
# Verify emails are in the inbox
```

#### **Phone Number Extraction Issues**
- **Format**: Emails should contain phone numbers in common formats
- **Examples**: `(555) 123-4567`, `+1-555-123-4567`, `555.123.4567`
- **Location**: Phone numbers can be in subject or email body

### **Debug Mode**
```bash
# Enable verbose logging
DEBUG=email:* npm run worker

# Check specific email processing
grep "Email processing" logs/worker.log
```

---

## 🔐 Security Considerations

### **Credentials Management**
- **Environment Variables**: Store credentials in `.env` file
- **Access Control**: Limit access to email credentials
- **Regular Rotation**: Change passwords periodically
- **Monitoring**: Monitor for unauthorized access

### **Email Security**
- **TLS/SSL**: Use encrypted connections (POP3S, SMTPS)
- **Authentication**: Require proper email account credentials
- **Rate Limiting**: Prevent email abuse and spam
- **Content Filtering**: Scan incoming emails for threats

---

## 📋 Maintenance Tasks

### **Weekly**
- **Check Email Queues**: Verify no stuck emails
- **Review Logs**: Check for unusual activity
- **Monitor Storage**: Ensure email storage isn't full
- **Test Connectivity**: Verify SMTP/POP3 connections

### **Monthly**
- **Rotate Passwords**: Update email account passwords
- **Clean Mailboxes**: Remove old processed emails
- **Review Templates**: Update email content as needed
- **Update Configuration**: Adjust settings based on usage

### **Quarterly**
- **Security Audit**: Review email security settings
- **Performance Review**: Analyze email processing metrics
- **Backup Configuration**: Save email configuration
- **Documentation Update**: Keep setup guide current

---

## 🎯 Best Practices

### **Email Content**
- **Clear Subject Lines**: Descriptive and informative
- **Personalization**: Use recipient names when possible
- **Mobile Optimization**: Ensure emails look good on mobile
- **Unsubscribe Links**: Include opt-out options

### **Lead Processing**
- **Phone Validation**: Extract and validate phone numbers
- **Duplicate Prevention**: Check for existing leads
- **Data Quality**: Ensure extracted data is accurate
- **Follow-up Planning**: Schedule appropriate follow-ups

### **System Performance**
- **Batch Processing**: Process emails in batches
- **Error Handling**: Graceful failure recovery
- **Resource Management**: Monitor memory and CPU usage
- **Scalability**: Plan for increased email volume

---

## 🚀 Go Live Checklist

### **✅ Pre-Deployment**
- [ ] Email accounts created in hosting panel
- [ ] SMTP credentials configured in `.env`
- [ ] POP3 credentials configured in `.env`
- [ ] Email templates reviewed and customized
- [ ] Test emails sent successfully

### **✅ Testing**
- [ ] SMTP connection test passed
- [ ] POP3 connection test passed
- [ ] Email processing test passed
- [ ] Lead creation from email test passed
- [ ] Error handling test passed

### **✅ Monitoring**
- [ ] Email status dashboard working
- [ ] Log monitoring configured
- [ ] Error alerts set up
- [ ] Performance metrics tracked
- [ ] Backup procedures documented

---

## 📞 Support

### **Email Provider Support**
- **Hosting Control Panel**: Manage email accounts
- **Server Administration**: Advanced email configuration
- **DNS Settings**: MX records and email routing
- **SSL Certificates**: Email encryption certificates

### **Application Support**
- **Configuration Help**: Environment variable setup
- **Troubleshooting**: Email processing issues
- **Customization**: Email template modifications
- **Integration**: Third-party email services

---

**🎉 Your Rebooked application is now ready to send and receive emails through your mail.rebooked.org server!**

*Configure your environment variables with the actual email credentials and restart the application to begin processing emails.*
