-- Initialize database with proper schema - handles both fresh and existing databases
-- This runs automatically on MySQL startup

ALTER TABLE users ADD COLUMN IF NOT EXISTS passwordHash varchar(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trialReminderSent boolean DEFAULT false NOT NULL;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS errorCount int DEFAULT 0 NOT NULL;
ALTER TABLE usage ADD COLUMN IF NOT EXISTS hasUsageAlerted boolean DEFAULT false NOT NULL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripePriceId varchar(255);
