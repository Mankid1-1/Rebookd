-- ════════════════════════════════════════════════════════════════════════════════
-- REBOOKD v2 - MYSQL INITIALIZATION SCRIPT
-- ════════════════════════════════════════════════════════════════════════════════
-- This script runs automatically when MySQL container starts for the first time

-- Use the rebookd database
USE rebookd;

-- ─── CREATE INDEXES FOR PERFORMANCE ───────────────────────────────────────────

-- Lead queries
CREATE INDEX idx_leads_tenant_status ON leads(tenantId, status);
CREATE INDEX idx_leads_tenant_appt ON leads(tenantId, appointmentAt);
CREATE INDEX idx_leads_tenant_created ON leads(tenantId, createdAt);
CREATE INDEX idx_leads_tenant_phone_hash ON leads(tenantId, phoneHash);

-- Message queries
CREATE INDEX idx_messages_tenant_created ON messages(tenantId, createdAt);
CREATE INDEX idx_messages_tenant_automation ON messages(tenantId, automationId);
CREATE INDEX idx_messages_tenant_lead ON messages(tenantId, leadId);
CREATE INDEX idx_messages_status ON messages(tenantId, status);
CREATE INDEX idx_messages_failed ON messages(tenantId, direction, status, createdAt);

-- Automation queries
CREATE INDEX idx_automations_tenant_enabled ON automations(tenantId, enabled);
CREATE INDEX idx_automations_tenant_trigger ON automations(tenantId, triggerType);
CREATE INDEX idx_automations_deleted ON automations(tenantId, deletedAt);

-- Automation jobs
CREATE INDEX idx_automation_jobs_tenant_next_run ON automation_jobs(tenantId, nextRunAt);
CREATE INDEX idx_automation_jobs_status ON automation_jobs(tenantId, status);

-- Subscription queries
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenantId);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripeId);
CREATE INDEX idx_subscriptions_status ON subscriptions(tenantId, status);

-- Usage queries
CREATE INDEX idx_usage_tenant ON usage(tenantId);
CREATE INDEX idx_usage_period ON usage(tenantId, periodStart, periodEnd);

-- User queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_openId ON users(openId);
CREATE INDEX idx_users_tenant ON users(tenantId);

-- Rate limiting
CREATE INDEX idx_sms_rate_limits_tenant_window ON sms_rate_limits(tenantId, windowStart);

-- Webhook dedup
CREATE INDEX idx_webhook_dedup_tenant_key ON webhookReceiveDedupes(tenantId, dedupeKey);

-- API keys
CREATE INDEX idx_api_keys_tenant ON apiKeys(tenantId);
CREATE INDEX idx_api_keys_prefix ON apiKeys(keyPrefix);

-- ─── SET DATABASE VARIABLES ───────────────────────────────────────────────────

-- Enable slow query logging (queries > 2 seconds)
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- Increase buffer sizes for better performance
SET GLOBAL innodb_buffer_pool_size = 1073741824;  -- 1GB (adjust based on available RAM)
SET GLOBAL query_cache_size = 0;                  -- Disable query cache (not efficient)

-- Connection settings
SET GLOBAL max_connections = 100;
SET GLOBAL max_allowed_packet = 268435456;  -- 256MB
SET GLOBAL wait_timeout = 28800;             -- 8 hours

-- ─── CREATE INITIAL ADMIN USER ────────────────────────────────────────────────

-- Default admin user (email: admin@rebooked.org, password: admin)
-- Password hash: $2a$10$... (bcryptjs with salt 10)
-- WARNING: Change password immediately in production!

INSERT IGNORE INTO users (openId, name, email, passwordHash, role, active, createdAt, updatedAt, lastSignedIn)
VALUES (
    'local_admin_default',
    'Admin',
    'admin@rebooked.org',
    '$2a$10$L9.IA/KfsHVVZEU9B2t6e.2p4KWpW6T9C2k.0RB1nL9R6xU0VEqJa',  -- 'admin' hashed
    'admin',
    1,
    NOW(),
    NOW(),
    NOW()
);

-- ─── CREATE INITIAL TENANT ────────────────────────────────────────────────────

-- Default tenant for development/testing
INSERT IGNORE INTO tenants (name, slug, timezone, active, createdAt, updatedAt)
VALUES (
    'Default Tenant',
    'default',
    'America/New_York',
    1,
    NOW(),
    NOW()
);

-- Get the tenant ID (for associations)
SET @tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1);

-- Link admin user to tenant
UPDATE users SET tenantId = @tenant_id WHERE email = 'admin@rebooked.org';

-- ─── CREATE INITIAL SUBSCRIPTION PLANS ────────────────────────────────────────

INSERT IGNORE INTO plans (name, slug, priceMonthly, maxAutomations, maxMessages, maxSeats, stripePriceId, revenueSharePercent)
VALUES
    ('Free', 'free', 0, 3, 100, 1, NULL, 0),
    ('Professional', 'professional', 19900, 25, 50000, 10, 'price_...', 15),
    ('Enterprise', 'enterprise', 0, 999, 999999, 999, NULL, 10);

-- ─── CREATE INITIAL SUBSCRIPTION ──────────────────────────────────────────────

INSERT IGNORE INTO subscriptions (tenantId, planId, status, currentPeriodStart, currentPeriodEnd, createdAt, updatedAt)
VALUES (
    @tenant_id,
    (SELECT id FROM plans WHERE slug = 'free' LIMIT 1),
    'active',
    NOW(),
    DATE_ADD(NOW(), INTERVAL 30 DAY),
    NOW(),
    NOW()
);

-- ─── CREATE INITIAL USAGE RECORD ──────────────────────────────────────────────

INSERT IGNORE INTO usage (tenantId, messagesSent, automationsRun, periodStart, periodEnd, createdAt, updatedAt)
VALUES (
    @tenant_id,
    0,
    0,
    NOW(),
    DATE_ADD(NOW(), INTERVAL 30 DAY),
    NOW(),
    NOW()
);

-- ─── CREATE DEFAULT PHONE NUMBER ──────────────────────────────────────────────

INSERT IGNORE INTO phoneNumbers (tenantId, number, label, isDefault, isInbound, createdAt)
VALUES (
    @tenant_id,
    '+1234567890',
    'Default Number',
    1,
    1,
    NOW()
);

-- ─── CREATE INITIAL AUTOMATIONS ───────────────────────────────────────────────

INSERT IGNORE INTO automations (tenantId, name, key, category, enabled, triggerType, triggerConfig, conditions, actions, createdAt, updatedAt)
VALUES
    (
        @tenant_id,
        'Welcome New Lead',
        'welcome_new_lead',
        'welcome',
        1,
        'new_lead',
        JSON_OBJECT(),
        JSON_ARRAY(),
        JSON_ARRAY(JSON_OBJECT('type', 'sms', 'message', 'Hi {{name}}, thanks for reaching out!')),
        NOW(),
        NOW()
    );

-- ─── VERIFY INITIAL DATA ──────────────────────────────────────────────────────

SELECT 'Initial Database Setup Complete!' AS Status;
SELECT COUNT(*) AS user_count FROM users;
SELECT COUNT(*) AS tenant_count FROM tenants;
SELECT COUNT(*) AS plan_count FROM plans;
SELECT COUNT(*) AS automation_count FROM automations;
SELECT COUNT(*) AS index_count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'rebookd' AND TABLE_NAME != 'information_schema';
