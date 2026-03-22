-- ================================================================================
-- REBOOKD v2 - COMPLETE DATABASE SCHEMA SETUP
-- ================================================================================
-- This script creates all tables, indexes, and initial data for production
-- Run this in MySQL console or via: mysql -u rebookd -p rebookd < this_file.sql
-- ================================================================================

-- Set character encoding
SET CHARACTER SET utf8mb4;
SET COLLATION_CONNECTION = utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 1: AUTHENTICATION & USER MANAGEMENT
-- ================================================================================

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) UNIQUE NOT NULL,
  name TEXT,
  email VARCHAR(320) UNIQUE,
  emailVerifiedAt TIMESTAMP NULL,
  loginMethod VARCHAR(64),
  passwordHash VARCHAR(255),
  role ENUM('user', 'admin') DEFAULT 'user' NOT NULL,
  tenantId INT,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  lastSignedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  INDEX users_email_idx (email),
  INDEX users_tenant_id_idx (tenantId),
  UNIQUE INDEX users_open_id_idx (openId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emailVerificationTokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  email VARCHAR(320) NOT NULL,
  tokenHash VARCHAR(255) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  consumedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS passwordResetTokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  tokenHash VARCHAR(255) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  consumedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 2: MULTI-TENANT ORGANIZATION STRUCTURE
-- ================================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  timezone VARCHAR(64) DEFAULT 'America/New_York' NOT NULL,
  industry VARCHAR(100),
  active BOOLEAN DEFAULT TRUE NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  INDEX tenants_slug_idx (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 3: BILLING & SUBSCRIPTION MANAGEMENT
-- ================================================================================

CREATE TABLE IF NOT EXISTS plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  priceMonthly INT DEFAULT 0 NOT NULL,
  maxAutomations INT DEFAULT 5 NOT NULL,
  maxMessages INT DEFAULT 500 NOT NULL,
  maxSeats INT DEFAULT 1 NOT NULL,
  stripePriceId VARCHAR(255),
  revenueSharePercent INT DEFAULT 0 NOT NULL,
  promotionalSlots INT DEFAULT 0 NOT NULL,
  promotionalPriceCap INT DEFAULT 0 NOT NULL,
  hasPromotion BOOLEAN DEFAULT FALSE NOT NULL,
  features JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  INDEX plans_slug_idx (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  planId INT NOT NULL,
  stripeId VARCHAR(255),
  status ENUM('active', 'trialing', 'past_due', 'canceled', 'unpaid') DEFAULT 'trialing' NOT NULL,
  trialEndsAt TIMESTAMP NULL,
  trialReminderSent BOOLEAN DEFAULT FALSE NOT NULL,
  currentPeriodStart TIMESTAMP NULL,
  currentPeriodEnd TIMESTAMP NULL,
  isPromotional BOOLEAN DEFAULT FALSE NOT NULL,
  promotionalExpiresAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (planId) REFERENCES plans(id),
  INDEX subscriptions_tenant_id_idx (tenantId),
  INDEX subscriptions_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billingInvoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  subscriptionId INT,
  stripeInvoiceId VARCHAR(255) UNIQUE NOT NULL,
  stripeChargeId VARCHAR(255),
  number VARCHAR(128),
  status VARCHAR(64) NOT NULL,
  currency VARCHAR(16) NOT NULL,
  subtotal INT DEFAULT 0 NOT NULL,
  total INT DEFAULT 0 NOT NULL,
  amountPaid INT DEFAULT 0 NOT NULL,
  amountRemaining INT DEFAULT 0 NOT NULL,
  hostedInvoiceUrl VARCHAR(500),
  invoicePdfUrl VARCHAR(500),
  periodStart TIMESTAMP NULL,
  periodEnd TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id),
  INDEX billing_invoices_tenant_id_idx (tenantId),
  INDEX billing_invoices_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billingRefunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  subscriptionId INT,
  billingInvoiceId INT,
  stripeRefundId VARCHAR(255) UNIQUE NOT NULL,
  stripeChargeId VARCHAR(255),
  amount INT NOT NULL,
  currency VARCHAR(16) NOT NULL,
  reason VARCHAR(100),
  status VARCHAR(64) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id),
  FOREIGN KEY (billingInvoiceId) REFERENCES billingInvoices(id),
  INDEX billing_refunds_tenant_id_idx (tenantId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  messagesSent INT DEFAULT 0 NOT NULL,
  automationsRun INT DEFAULT 0 NOT NULL,
  hasUsageAlerted BOOLEAN DEFAULT FALSE NOT NULL,
  periodStart TIMESTAMP NOT NULL,
  periodEnd TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE INDEX usage_tenant_period_idx (tenantId, periodStart, periodEnd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 4: SMS PHONE NUMBERS & COMMUNICATION
-- ================================================================================

CREATE TABLE IF NOT EXISTS phoneNumbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  number VARCHAR(20) UNIQUE NOT NULL,
  label VARCHAR(100),
  isDefault BOOLEAN DEFAULT FALSE NOT NULL,
  isInbound BOOLEAN DEFAULT FALSE NOT NULL,
  twilioSid VARCHAR(100),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deletedAt TIMESTAMP NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX phone_numbers_tenant_id_idx (tenantId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 5: LEADS MANAGEMENT
-- ================================================================================

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  phoneHash VARCHAR(64) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(320),
  status ENUM('new', 'contacted', 'qualified', 'booked', 'lost', 'unsubscribed') DEFAULT 'new' NOT NULL,
  source VARCHAR(100),
  tags JSON,
  notes TEXT,
  lastMessageAt TIMESTAMP NULL,
  lastInboundAt TIMESTAMP NULL,
  appointmentAt TIMESTAMP NULL,
  
  -- TCPA Compliance
  smsConsentAt TIMESTAMP NULL,
  smsConsentSource VARCHAR(100),
  tcpaConsentText TEXT,
  unsubscribedAt TIMESTAMP NULL,
  unsubscribeMethod VARCHAR(50),
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX leads_tenant_id_idx (tenantId),
  UNIQUE INDEX leads_phone_hash_idx (tenantId, phoneHash),
  INDEX leads_status_idx (tenantId, status),
  INDEX leads_created_at_idx (tenantId, createdAt),
  INDEX leads_search_idx (tenantId, phone, name, email),
  INDEX leads_consent_idx (tenantId, smsConsentAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 6: MESSAGING SYSTEM
-- ================================================================================

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  leadId INT NOT NULL,
  direction ENUM('inbound', 'outbound') NOT NULL,
  body TEXT NOT NULL,
  fromNumber VARCHAR(20),
  toNumber VARCHAR(20),
  twilioSid VARCHAR(100),
  status ENUM('queued', 'sent', 'delivered', 'failed', 'received') DEFAULT 'queued' NOT NULL,
  provider VARCHAR(50),
  providerError TEXT,
  retryCount INT DEFAULT 0 NOT NULL,
  idempotencyKey VARCHAR(64),
  deliveredAt TIMESTAMP NULL,
  failedAt TIMESTAMP NULL,
  aiRewritten BOOLEAN DEFAULT FALSE NOT NULL,
  tone VARCHAR(50),
  automationId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX messages_tenant_id_idx (tenantId),
  INDEX messages_lead_id_idx (leadId),
  INDEX messages_tenant_lead_idx (tenantId, leadId),
  INDEX messages_created_at_idx (tenantId, createdAt),
  UNIQUE INDEX messages_idempotency_key_idx (tenantId, idempotencyKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 7: MESSAGE TEMPLATES
-- ================================================================================

CREATE TABLE IF NOT EXISTS templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  key VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  tone ENUM('friendly', 'professional', 'casual', 'urgent') DEFAULT 'friendly' NOT NULL,
  variables JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  deletedAt TIMESTAMP NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX templates_tenant_id_idx (tenantId),
  UNIQUE INDEX templates_tenant_key_idx (tenantId, key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 8: AUTOMATION WORKFLOWS
-- ================================================================================

CREATE TABLE IF NOT EXISTS automations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  key VARCHAR(100) NOT NULL,
  category ENUM('follow_up', 'reactivation', 'appointment', 'welcome', 'custom', 'no_show', 'cancellation', 'loyalty') DEFAULT 'custom' NOT NULL,
  enabled BOOLEAN DEFAULT TRUE NOT NULL,
  triggerType ENUM('new_lead', 'inbound_message', 'status_change', 'time_delay', 'appointment_reminder') DEFAULT 'new_lead' NOT NULL,
  triggerConfig JSON,
  conditions JSON,
  actions JSON,
  runCount INT DEFAULT 0 NOT NULL,
  errorCount INT DEFAULT 0 NOT NULL,
  lastRunAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  deletedAt TIMESTAMP NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX automations_tenant_id_idx (tenantId),
  INDEX automations_enabled_idx (tenantId, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automationJobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  automationId INT NOT NULL,
  leadId INT,
  eventType VARCHAR(100) NOT NULL,
  eventData JSON,
  stepIndex INT DEFAULT 0 NOT NULL,
  nextRunAt TIMESTAMP NOT NULL,
  status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending' NOT NULL,
  attempts INT DEFAULT 0 NOT NULL,
  lastError TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (automationId) REFERENCES automations(id) ON DELETE CASCADE,
  FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
  INDEX automation_jobs_tenant_id_idx (tenantId),
  INDEX automation_jobs_status_idx (status, nextRunAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 9: AI & ANALYTICS
-- ================================================================================

CREATE TABLE IF NOT EXISTS aiMessageLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  leadId INT,
  original TEXT NOT NULL,
  rewritten TEXT,
  tone VARCHAR(50) NOT NULL,
  success BOOLEAN DEFAULT TRUE NOT NULL,
  error TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
  INDEX ai_message_logs_tenant_id_idx (tenantId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 10: WEBHOOKS & INTEGRATIONS
-- ================================================================================

CREATE TABLE IF NOT EXISTS webhookLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT,
  url VARCHAR(500) NOT NULL,
  payload TEXT NOT NULL,
  statusCode INT,
  error TEXT,
  attempts INT DEFAULT 0 NOT NULL,
  nextRetryAt TIMESTAMP NULL,
  resolved BOOLEAN DEFAULT FALSE NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE SET NULL,
  INDEX webhook_logs_tenant_id_idx (tenantId),
  INDEX webhook_logs_resolved_idx (resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apiKeys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  keyHash VARCHAR(255) NOT NULL,
  keyPrefix VARCHAR(10) NOT NULL,
  label VARCHAR(100),
  active BOOLEAN DEFAULT TRUE NOT NULL,
  lastUsedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX api_keys_tenant_id_idx (tenantId),
  UNIQUE INDEX api_keys_prefix_idx (keyPrefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhookReceiveDedupes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  dedupeKey VARCHAR(64) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE INDEX webhook_receive_dedupes_tenant_dedupe_uidx (tenantId, dedupeKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 11: MONITORING & LOGGING
-- ================================================================================

CREATE TABLE IF NOT EXISTS systemErrorLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('twilio', 'ai', 'automation', 'billing', 'webhook') NOT NULL,
  message TEXT NOT NULL,
  detail TEXT,
  tenantId INT,
  resolved BOOLEAN DEFAULT FALSE NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE SET NULL,
  INDEX system_error_logs_type_idx (type),
  INDEX system_error_logs_resolved_idx (resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS adminAuditLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  adminUserId INT NOT NULL,
  adminEmail VARCHAR(320),
  action VARCHAR(120) NOT NULL,
  targetTenantId INT,
  targetUserId INT,
  route VARCHAR(255),
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (adminUserId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (targetTenantId) REFERENCES tenants(id) ON DELETE SET NULL,
  INDEX admin_audit_logs_admin_id_idx (adminUserId),
  INDEX admin_audit_logs_action_idx (action),
  INDEX admin_audit_logs_created_at_idx (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 12: RATE LIMITING & CIRCUIT BREAKERS
-- ================================================================================

CREATE TABLE IF NOT EXISTS smsRateLimits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  windowStart TIMESTAMP NOT NULL,
  count INT DEFAULT 0 NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE INDEX sms_rate_limits_tenant_window_idx (tenantId, windowStart)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS llmCircuitBreakers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  state ENUM('closed', 'open', 'half_open') DEFAULT 'closed' NOT NULL,
  consecutiveFailures INT DEFAULT 0 NOT NULL,
  openedAt TIMESTAMP NULL,
  cooldownUntil TIMESTAMP NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  UNIQUE INDEX llm_circuit_breakers_provider_model_idx (provider, model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS authRateLimits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  UNIQUE INDEX auth_rate_limits_email_created_idx (email, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================================
-- SECTION 13: INITIAL DATA SEEDING
-- ================================================================================

-- Insert default plans
INSERT IGNORE INTO plans (name, slug, priceMonthly, maxAutomations, maxMessages, maxSeats, stripePriceId, features, createdAt) VALUES
  ('Free', 'free', 0, 2, 50, 1, NULL, JSON_ARRAY('sms_automation', 'basic_analytics'), NOW()),
  ('Starter', 'starter', 2999, 5, 500, 3, 'price_starter', JSON_ARRAY('sms_automation', 'advanced_analytics', 'templates', 'webhooks'), NOW()),
  ('Professional', 'professional', 9999, 20, 5000, 10, 'price_professional', JSON_ARRAY('sms_automation', 'advanced_analytics', 'templates', 'webhooks', 'api_access', 'priority_support'), NOW()),
  ('Enterprise', 'enterprise', 29999, 100, 50000, 50, 'price_enterprise', JSON_ARRAY('sms_automation', 'advanced_analytics', 'templates', 'webhooks', 'api_access', 'priority_support', 'dedicated_support', 'custom_integrations'), NOW());

-- Insert default tenant (for testing)
INSERT IGNORE INTO tenants (name, slug, timezone, industry, active, createdAt) VALUES
  ('Rebookd Demo', 'rebookd-demo', 'America/New_York', 'Technology', TRUE, NOW());

-- Insert default user (admin)
INSERT IGNORE INTO users (openId, name, email, emailVerifiedAt, loginMethod, passwordHash, role, tenantId, active, createdAt) VALUES
  ('admin_default_001', 'Admin User', 'brendanjj96@outlook.com', NOW(), 'local', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'admin', 1, TRUE, NOW());

-- Insert default subscription for tenant
INSERT IGNORE INTO subscriptions (tenantId, planId, status, trialEndsAt, currentPeriodStart, currentPeriodEnd, createdAt) VALUES
  (1, 1, 'trialing', DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH), NOW());

-- Insert default phone number
INSERT IGNORE INTO phoneNumbers (tenantId, number, label, isDefault, isInbound, createdAt) VALUES
  (1, '+1234567890', 'Primary', TRUE, TRUE, NOW());

-- ================================================================================
-- SECTION 14: PERFORMANCE OPTIMIZATION - ANALYZE TABLES
-- ================================================================================

ANALYZE TABLE users;
ANALYZE TABLE tenants;
ANALYZE TABLE plans;
ANALYZE TABLE subscriptions;
ANALYZE TABLE billingInvoices;
ANALYZE TABLE usage;
ANALYZE TABLE leads;
ANALYZE TABLE messages;
ANALYZE TABLE templates;
ANALYZE TABLE automations;
ANALYZE TABLE automationJobs;
ANALYZE TABLE phoneNumbers;
ANALYZE TABLE webhookLogs;
ANALYZE TABLE systemErrorLogs;
ANALYZE TABLE adminAuditLogs;

-- ================================================================================
-- SECTION 15: VERIFICATION
-- ================================================================================

-- Verify all tables created
SELECT 
  TABLE_NAME, 
  TABLE_ROWS,
  DATA_LENGTH,
  INDEX_LENGTH
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

-- Verify character set
SELECT @@character_set_database, @@collation_database;

-- Show database size
SELECT 
  SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024 as 'Database Size (MB)'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE();

-- ================================================================================
-- SECTION 16: POST-INSTALLATION COMMANDS
-- ================================================================================

-- Enable slow query logging
-- SET GLOBAL slow_query_log = 'ON';
-- SET GLOBAL long_query_time = 2;

-- Show MySQL variables
-- SHOW VARIABLES LIKE 'max_connections';
-- SHOW VARIABLES LIKE 'max_allowed_packet';

-- ================================================================================
-- SUCCESS MESSAGE
-- ================================================================================

-- If you see all tables listed above without errors, the database is ready!
-- Next steps:
-- 1. Update .env.production with DB credentials
-- 2. Start Docker services: docker-compose -f docker-compose.prod.yml up -d
-- 3. Application will be available at http://localhost:3000

-- ================================================================================
-- END OF DATABASE SETUP SCRIPT
-- ================================================================================
