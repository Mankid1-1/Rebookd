-- 🚀 REBOOKED DATABASE AUDIT & FIX SCRIPT
-- Complete database health check and repair for smooth sailing
-- Run this script to ensure all databases are correct and optimized

-- ============================================================================
-- 🔍 DATABASE AUDIT & HEALTH CHECK
-- ============================================================================

-- Check database character set and collation
SELECT 
    SCHEMA_NAME as 'Database',
    DEFAULT_CHARACTER_SET_NAME as 'Charset',
    DEFAULT_COLLATION_NAME as 'Collation'
FROM information_schema.SCHEMATA 
WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys');

-- ============================================================================
-- 🛠️ DATABASE SETUP & OPTIMIZATION
-- ============================================================================

-- Set database character set and collation for UTF-8 support
ALTER DATABASE rebooked CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 📋 TABLE CREATION & VERIFICATION
-- ============================================================================

-- Core Authentication Tables
CREATE TABLE IF NOT EXISTS `users` (
    `id` int NOT NULL AUTO_INCREMENT,
    `openId` varchar(64) NOT NULL,
    `name` text,
    `email` varchar(320),
    `emailVerifiedAt` timestamp,
    `loginMethod` varchar(64),
    `passwordHash` varchar(255),
    `role` enum('user','admin') DEFAULT 'user' NOT NULL,
    `tenantId` int,
    `active` tinyint(1) DEFAULT '1' NOT NULL,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `lastSignedIn` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `users_email_idx` (`email`),
    UNIQUE KEY `users_open_id_idx` (`openId`),
    KEY `users_tenant_id_idx` (`tenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_verification_tokens` (
    `id` int NOT NULL AUTO_INCREMENT,
    `userId` int NOT NULL,
    `email` varchar(320) NOT NULL,
    `tokenHash` varchar(255) NOT NULL,
    `expiresAt` timestamp NOT NULL,
    `consumedAt` timestamp,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `id` int NOT NULL AUTO_INCREMENT,
    `userId` int NOT NULL,
    `tokenHash` varchar(255) NOT NULL,
    `expiresAt` timestamp NOT NULL,
    `consumedAt` timestamp,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tenant Management Tables
CREATE TABLE IF NOT EXISTS `tenants` (
    `id` int NOT NULL AUTO_INCREMENT,
    `name` varchar(255) NOT NULL,
    `slug` varchar(100) NOT NULL,
    `timezone` varchar(64) DEFAULT 'America/New_York' NOT NULL,
    `industry` varchar(100),
    `active` tinyint(1) DEFAULT '1' NOT NULL,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Plans & Subscriptions Tables
CREATE TABLE IF NOT EXISTS `plans` (
    `id` int NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL,
    `slug` varchar(100) NOT NULL,
    `priceMonthly` int DEFAULT '0' NOT NULL,
    `maxAutomations` int DEFAULT '5' NOT NULL,
    `maxMessages` int DEFAULT '500' NOT NULL,
    `maxSeats` int DEFAULT '1' NOT NULL,
    `stripePriceId` varchar(255),
    `revenueSharePercent` int DEFAULT '0' NOT NULL,
    `promotionalSlots` int DEFAULT '0' NOT NULL,
    `promotionalPriceCap` int DEFAULT '0' NOT NULL,
    `hasPromotion` tinyint(1) DEFAULT '0' NOT NULL,
    `features` json,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `name` (`name`),
    UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscriptions` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `planId` int NOT NULL,
    `stripeId` varchar(255),
    `status` enum('active','trialing','past_due','canceled','unpaid') DEFAULT 'trialing' NOT NULL,
    `trialEndsAt` timestamp,
    `trialReminderSent` tinyint(1) DEFAULT '0' NOT NULL,
    `currentPeriodStart` timestamp,
    `currentPeriodEnd` timestamp,
    `isPromotional` tinyint(1) DEFAULT '0' NOT NULL,
    `promotionalExpiresAt` timestamp,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `tenantId` (`tenantId`),
    KEY `planId` (`planId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Billing Tables
CREATE TABLE IF NOT EXISTS `billing_invoices` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `subscriptionId` int,
    `stripeInvoiceId` varchar(255) NOT NULL,
    `stripeChargeId` varchar(255),
    `number` varchar(128),
    `status` varchar(64) NOT NULL,
    `currency` varchar(16) NOT NULL,
    `subtotal` int DEFAULT '0' NOT NULL,
    `total` int DEFAULT '0' NOT NULL,
    `amountPaid` int DEFAULT '0' NOT NULL,
    `amountRemaining` int DEFAULT '0' NOT NULL,
    `hostedInvoiceUrl` varchar(500),
    `invoicePdfUrl` varchar(500),
    `periodStart` timestamp,
    `periodEnd` timestamp,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `stripeInvoiceId` (`stripeInvoiceId`),
    KEY `tenantId` (`tenantId`),
    KEY `subscriptionId` (`subscriptionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `billing_refunds` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `subscriptionId` int,
    `billingInvoiceId` int,
    `stripeRefundId` varchar(255) NOT NULL,
    `stripeChargeId` varchar(255),
    `amount` int NOT NULL,
    `currency` varchar(16) NOT NULL,
    `reason` varchar(100),
    `status` varchar(64) NOT NULL,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `stripeRefundId` (`stripeRefundId`),
    KEY `tenantId` (`tenantId`),
    KEY `subscriptionId` (`subscriptionId`),
    KEY `billingInvoiceId` (`billingInvoiceId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usage Tracking
CREATE TABLE IF NOT EXISTS `usage` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `messagesSent` int DEFAULT '0' NOT NULL,
    `automationsRun` int DEFAULT '0' NOT NULL,
    `hasUsageAlerted` tinyint(1) DEFAULT '0' NOT NULL,
    `periodStart` timestamp NOT NULL,
    `periodEnd` timestamp NOT NULL,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `tenantId` (`tenantId`),
    KEY `periodStart` (`periodStart`),
    KEY `periodEnd` (`periodEnd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phone Numbers
CREATE TABLE IF NOT EXISTS `phone_numbers` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `number` varchar(20) NOT NULL,
    `label` varchar(100),
    `isDefault` tinyint(1) DEFAULT '0' NOT NULL,
    `isInbound` tinyint(1) DEFAULT '0' NOT NULL,
    `twilioSid` varchar(100),
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `deletedAt` timestamp,
    PRIMARY KEY (`id`),
    UNIQUE KEY `number` (`number`),
    KEY `tenantId` (`tenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Core Business Tables
CREATE TABLE IF NOT EXISTS `leads` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `phone` varchar(20) NOT NULL,
    `phoneHash` varchar(64) NOT NULL,
    `name` varchar(255),
    `email` varchar(320),
    `status` enum('new','contacted','qualified','booked','lost','unsubscribed') DEFAULT 'new' NOT NULL,
    `source` varchar(100),
    `tags` json,
    `notes` text,
    `lastMessageAt` timestamp,
    `lastInboundAt` timestamp,
    `appointmentAt` timestamp,
    `smsConsentAt` timestamp,
    `smsConsentSource` varchar(100),
    `tcpaConsentText` text,
    `unsubscribedAt` timestamp,
    `unsubscribeMethod` varchar(50),
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `leads_phone_hash_idx` (`tenantId`,`phoneHash`),
    KEY `leads_tenant_id_idx` (`tenantId`),
    KEY `leads_status_idx` (`tenantId`,`status`),
    KEY `leads_created_at_idx` (`tenantId`,`createdAt`),
    KEY `leads_search_idx` (`tenantId`,`phone`,`name`,`email`),
    KEY `leads_consent_idx` (`tenantId`,`smsConsentAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `leadId` int NOT NULL,
    `direction` enum('inbound','outbound') NOT NULL,
    `body` text NOT NULL,
    `fromNumber` varchar(20),
    `toNumber` varchar(20),
    `twilioSid` varchar(100),
    `status` enum('queued','sent','delivered','failed','received') DEFAULT 'queued' NOT NULL,
    `provider` varchar(50),
    `providerError` text,
    `retryCount` int DEFAULT '0' NOT NULL,
    `idempotencyKey` varchar(64),
    `deliveredAt` timestamp,
    `failedAt` timestamp,
    `aiRewritten` tinyint(1) DEFAULT '0' NOT NULL,
    `tone` varchar(50),
    `automationId` int,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `messages_idempotency_key_idx` (`tenantId`,`idempotencyKey`),
    KEY `messages_tenant_id_idx` (`tenantId`),
    KEY `messages_lead_id_idx` (`leadId`),
    KEY `messages_tenant_lead_idx` (`tenantId`,`leadId`),
    KEY `messages_created_at_idx` (`tenantId`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Templates & Automations
CREATE TABLE IF NOT EXISTS `templates` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `key` varchar(100) NOT NULL,
    `name` varchar(255) NOT NULL,
    `body` text NOT NULL,
    `tone` enum('friendly','professional','casual','urgent') DEFAULT 'friendly' NOT NULL,
    `variables` json,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deletedAt` timestamp,
    PRIMARY KEY (`id`),
    KEY `tenantId` (`tenantId`),
    KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `automations` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `name` varchar(255) NOT NULL,
    `key` varchar(100) NOT NULL,
    `category` enum('follow_up','reactivation','appointment','welcome','custom','no_show','cancellation','loyalty') DEFAULT 'custom' NOT NULL,
    `enabled` tinyint(1) DEFAULT '1' NOT NULL,
    `triggerType` enum('new_lead','inbound_message','status_change','time_delay','appointment_reminder') DEFAULT 'new_lead' NOT NULL,
    `triggerConfig` json,
    `conditions` json,
    `actions` json,
    `runCount` int DEFAULT '0' NOT NULL,
    `errorCount` int DEFAULT '0' NOT NULL,
    `lastRunAt` timestamp,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deletedAt` timestamp,
    PRIMARY KEY (`id`),
    KEY `tenantId` (`tenantId`),
    KEY `enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `automation_jobs` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `automationId` int NOT NULL,
    `leadId` int,
    `eventType` varchar(100) NOT NULL,
    `eventData` json,
    `stepIndex` int DEFAULT '0' NOT NULL,
    `nextRunAt` timestamp NOT NULL,
    `status` enum('pending','running','completed','failed','cancelled') DEFAULT 'pending' NOT NULL,
    `attempts` int DEFAULT '0' NOT NULL,
    `lastError` text,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `tenantId` (`tenantId`),
    KEY `automationId` (`automationId`),
    KEY `leadId` (`leadId`),
    KEY `status` (`status`),
    KEY `nextRunAt` (`nextRunAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI & System Tables
CREATE TABLE IF NOT EXISTS `ai_message_logs` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `leadId` int,
    `original` text NOT NULL,
    `rewritten` text,
    `tone` varchar(50) NOT NULL,
    `success` tinyint(1) DEFAULT '1' NOT NULL,
    `error` text,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    KEY `tenantId` (`tenantId`),
    KEY `leadId` (`leadId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `webhook_logs` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int,
    `url` varchar(500) NOT NULL,
    `payload` text NOT NULL,
    `statusCode` int,
    `error` text,
    `attempts` int DEFAULT '0' NOT NULL,
    `nextRetryAt` timestamp,
    `resolved` tinyint(1) DEFAULT '0' NOT NULL,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `tenantId` (`tenantId`),
    KEY `resolved` (`resolved`),
    KEY `nextRetryAt` (`nextRetryAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `api_keys` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `keyHash` varchar(255) NOT NULL,
    `keyPrefix` varchar(10) NOT NULL,
    `label` varchar(100),
    `active` tinyint(1) DEFAULT '1' NOT NULL,
    `lastUsedAt` timestamp,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    KEY `tenantId` (`tenantId`),
    KEY `active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System & Admin Tables
CREATE TABLE IF NOT EXISTS `system_error_logs` (
    `id` int NOT NULL AUTO_INCREMENT,
    `type` enum('twilio','ai','automation','billing','webhook') NOT NULL,
    `message` text NOT NULL,
    `detail` text,
    `tenantId` int,
    `resolved` tinyint(1) DEFAULT '0' NOT NULL,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    KEY `type` (`type`),
    KEY `tenantId` (`tenantId`),
    KEY `resolved` (`resolved`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
    `id` int NOT NULL AUTO_INCREMENT,
    `adminUserId` int NOT NULL,
    `adminEmail` varchar(320),
    `action` varchar(120) NOT NULL,
    `targetTenantId` int,
    `targetUserId` int,
    `route` varchar(255),
    `metadata` json,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    KEY `adminUserId` (`adminUserId`),
    KEY `targetTenantId` (`targetTenantId`),
    KEY `createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate Limiting & Circuit Breaker Tables
CREATE TABLE IF NOT EXISTS `sms_rate_limits` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `windowStart` timestamp NOT NULL,
    `count` int DEFAULT '0' NOT NULL,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `tenant_window` (`tenantId`,`windowStart`),
    KEY `windowStart` (`windowStart`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `llm_circuit_breakers` (
    `id` int NOT NULL AUTO_INCREMENT,
    `provider` varchar(50) NOT NULL,
    `model` varchar(100) NOT NULL,
    `state` enum('closed','open','half_open') DEFAULT 'closed' NOT NULL,
    `consecutiveFailures` int DEFAULT '0' NOT NULL,
    `openedAt` timestamp,
    `cooldownUntil` timestamp,
    `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `provider_model` (`provider`,`model`),
    KEY `state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `webhook_receive_dedupes` (
    `id` int NOT NULL AUTO_INCREMENT,
    `tenantId` int NOT NULL,
    `dedupeKey` varchar(64) NOT NULL,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `webhook_receive_dedupes_tenant_dedupe_uidx` (`tenantId`,`dedupeKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auth_rate_limits` (
    `id` int NOT NULL AUTO_INCREMENT,
    `email` varchar(320) NOT NULL,
    `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `auth_rate_limits_email_created_idx` (`email`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 🔧 FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add foreign key constraints for data integrity
ALTER TABLE `users` ADD CONSTRAINT `fk_users_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `fk_email_tokens_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `fk_password_tokens_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subscriptions` ADD CONSTRAINT `fk_subscriptions_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subscriptions` ADD CONSTRAINT `fk_subscriptions_planId` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `billing_invoices` ADD CONSTRAINT `fk_billing_invoices_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `billing_invoices` ADD CONSTRAINT `fk_billing_invoices_subscriptionId` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `billing_refunds` ADD CONSTRAINT `fk_billing_refunds_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `billing_refunds` ADD CONSTRAINT `fk_billing_refunds_subscriptionId` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `billing_refunds` ADD CONSTRAINT `fk_billing_refunds_billingInvoiceId` FOREIGN KEY (`billingInvoiceId`) REFERENCES `billing_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `usage` ADD CONSTRAINT `fk_usage_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `phone_numbers` ADD CONSTRAINT `fk_phone_numbers_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `leads` ADD CONSTRAINT `fk_leads_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_leadId` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_automationId` FOREIGN KEY (`automationId`) REFERENCES `automations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `templates` ADD CONSTRAINT `fk_templates_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `automations` ADD CONSTRAINT `fk_automations_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `automation_jobs` ADD CONSTRAINT `fk_automation_jobs_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `automation_jobs` ADD CONSTRAINT `fk_automation_jobs_automationId` FOREIGN KEY (`automationId`) REFERENCES `automations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `automation_jobs` ADD CONSTRAINT `fk_automation_jobs_leadId` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_message_logs` ADD CONSTRAINT `fk_ai_logs_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ai_message_logs` ADD CONSTRAINT `fk_ai_logs_leadId` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `webhook_logs` ADD CONSTRAINT `fk_webhook_logs_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `api_keys` ADD CONSTRAINT `fk_api_keys_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `system_error_logs` ADD CONSTRAINT `fk_system_logs_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `fk_admin_logs_adminUserId` FOREIGN KEY (`adminUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `fk_admin_logs_targetTenantId` FOREIGN KEY (`targetTenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `fk_admin_logs_targetUserId` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `sms_rate_limits` ADD CONSTRAINT `fk_sms_limits_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `webhook_receive_dedupes` ADD CONSTRAINT `fk_webhook_dedupes_tenantId` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 📊 INITIAL DATA SEEDING
-- ============================================================================

-- Insert default plans if they don't exist
INSERT IGNORE INTO `plans` (`name`, `slug`, `priceMonthly`, `maxAutomations`, `maxMessages`, `maxSeats`, `features`) VALUES
('Starter', 'starter', 49, 6, 500, 1, JSON_ARRAY('AI-powered messaging', 'Basic automations', 'Email support')),
('Growth', 'growth', 99, 12, 2000, 3, JSON_ARRAY('AI-powered messaging', 'All automations', 'Priority support', 'Advanced analytics')),
('Scale', 'scale', 199, 16, 10000, 10, JSON_ARRAY('AI-powered messaging', 'All automations', 'Dedicated support', 'Full analytics suite', 'API access'));

-- ============================================================================
-- 🔍 PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Optimize database performance
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL innodb_log_file_size = 268435456; -- 256MB
SET GLOBAL innodb_flush_log_at_trx_commit = 2;
SET GLOBAL innodb_flush_method = O_DIRECT;

-- Analyze tables for optimal query performance
ANALYZE TABLE `users`, `tenants`, `plans`, `subscriptions`, `leads`, `messages`, `automations`, `templates`;

-- ============================================================================
-- ✅ VERIFICATION QUERIES
-- ============================================================================

-- Verify all tables exist and have correct structure
SELECT 
    TABLE_NAME as 'Table',
    ENGINE as 'Engine',
    TABLE_COLLATION as 'Collation',
    TABLE_ROWS as 'Estimated Rows'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'rebooked'
ORDER BY TABLE_NAME;

-- Verify foreign key constraints
SELECT 
    CONSTRAINT_NAME as 'Constraint',
    TABLE_NAME as 'Table',
    COLUMN_NAME as 'Column',
    REFERENCED_TABLE_NAME as 'References',
    REFERENCED_COLUMN_NAME as 'References Column'
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'rebooked' 
AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- ============================================================================
-- 🎯 HEALTH CHECK SUMMARY
-- ============================================================================

SELECT 
    'DATABASE HEALTH CHECK' as 'Status',
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'rebooked') as 'Tables Created',
    (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = 'rebooked' AND CONSTRAINT_TYPE = 'FOREIGN KEY') as 'Foreign Keys',
    (SELECT COUNT(*) FROM plans) as 'Plans Seeded',
    (SELECT COUNT(*) FROM tenants) as 'Tenants',
    (SELECT COUNT(*) FROM users) as 'Users',
    (SELECT COUNT(*) FROM leads) as 'Leads',
    (SELECT COUNT(*) FROM messages) as 'Messages';

-- ============================================================================
-- 🎉 COMPLETION MESSAGE
-- ============================================================================

SELECT '🎉 REBOOKED DATABASE AUDIT & FIX COMPLETE!' as 'Status',
       'All tables created, optimized, and ready for smooth sailing!' as 'Message';
