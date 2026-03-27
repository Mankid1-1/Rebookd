CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
CREATE TABLE `ai_message_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`leadId` int,
	`original` text NOT NULL,
	`rewritten` text,
	`tone` varchar(50) NOT NULL,
	`success` boolean NOT NULL DEFAULT true,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_message_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`keyHash` varchar(255) NOT NULL,
	`keyPrefix` varchar(10) NOT NULL,
	`label` varchar(100),
	`active` boolean NOT NULL DEFAULT true,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`key` varchar(100) NOT NULL,
	`category` enum('follow_up','reactivation','appointment','welcome','custom') NOT NULL DEFAULT 'custom',
	`enabled` boolean NOT NULL DEFAULT true,
	`triggerType` enum('new_lead','inbound_message','status_change','time_delay','appointment_reminder') NOT NULL DEFAULT 'new_lead',
	`triggerConfig` json DEFAULT ('{}'),
	`conditions` json DEFAULT ('[]'),
	`actions` json DEFAULT ('[]'),
	`runCount` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`phone` varchar(20) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`status` enum('new','contacted','qualified','booked','lost','unsubscribed') NOT NULL DEFAULT 'new',
	`source` varchar(100),
	`tags` json DEFAULT ('[]'),
	`notes` text,
	`lastMessageAt` timestamp,
	`lastInboundAt` timestamp,
	`appointmentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`leadId` int NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`body` text NOT NULL,
	`fromNumber` varchar(20),
	`toNumber` varchar(20),
	`twilioSid` varchar(100),
	`status` enum('queued','sent','delivered','failed','received') NOT NULL DEFAULT 'queued',
	`aiRewritten` boolean NOT NULL DEFAULT false,
	`tone` varchar(50),
	`automationId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phone_numbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`number` varchar(20) NOT NULL,
	`label` varchar(100),
	`isDefault` boolean NOT NULL DEFAULT false,
	`isInbound` boolean NOT NULL DEFAULT false,
	`twilioSid` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phone_numbers_id` PRIMARY KEY(`id`),
	CONSTRAINT `phone_numbers_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`priceMonthly` int NOT NULL DEFAULT 0,
	`maxAutomations` int NOT NULL DEFAULT 5,
	`maxMessages` int NOT NULL DEFAULT 500,
	`maxSeats` int NOT NULL DEFAULT 1,
	`features` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_name_unique` UNIQUE(`name`),
	CONSTRAINT `plans_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`planId` int NOT NULL,
	`stripeId` varchar(255),
	`status` enum('active','trialing','past_due','canceled','unpaid') NOT NULL DEFAULT 'trialing',
	`trialEndsAt` timestamp,
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_error_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('twilio','ai','automation','billing','webhook') NOT NULL,
	`message` text NOT NULL,
	`detail` text,
	`tenantId` int,
	`resolved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_error_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`key` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`tone` enum('friendly','professional','casual','urgent') NOT NULL DEFAULT 'friendly',
	`variables` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'America/New_York',
	`industry` varchar(100),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`messagesSent` int NOT NULL DEFAULT 0,
	`automationsRun` int NOT NULL DEFAULT 0,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`payload` text NOT NULL,
	`statusCode` int,
	`error` text,
	`attempts` int NOT NULL DEFAULT 0,
	`nextRetryAt` timestamp,
	`resolved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhook_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;ALTER TABLE `automations` MODIFY COLUMN `triggerConfig` json;--> statement-breakpoint
ALTER TABLE `automations` MODIFY COLUMN `conditions` json;--> statement-breakpoint
ALTER TABLE `automations` MODIFY COLUMN `actions` json;--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `plans` MODIFY COLUMN `features` json;--> statement-breakpoint
ALTER TABLE `templates` MODIFY COLUMN `variables` json;--> statement-breakpoint
ALTER TABLE `automations` ADD `errorCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `stripePriceId` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `trialReminderSent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `usage` ADD `hasUsageAlerted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);ALTER TABLE `leads` ADD `phoneHash` varchar(64) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `messages` ADD `provider` varchar(50);--> statement-breakpoint
ALTER TABLE `messages` ADD `providerError` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `retryCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `idempotencyKey` varchar(64);--> statement-breakpoint
ALTER TABLE `messages` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `messages` ADD `failedAt` timestamp;--> statement-breakpoint
ALTER TABLE `templates` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `automations` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `phone_numbers` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `webhook_logs` MODIFY COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `automations` MODIFY COLUMN `category` enum('follow_up','reactivation','appointment','welcome','custom','no_show','cancellation','loyalty') NOT NULL DEFAULT 'custom';--> statement-breakpoint
CREATE TABLE `sms_rate_limits` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `windowStart` timestamp NOT NULL,
  `count` int NOT NULL DEFAULT 0,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `sms_rate_limits_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE TABLE `llm_circuit_breakers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `provider` varchar(50) NOT NULL,
  `model` varchar(100) NOT NULL,
  `state` enum('closed','open','half_open') NOT NULL DEFAULT 'closed',
  `consecutiveFailures` int NOT NULL DEFAULT 0,
  `openedAt` timestamp,
  `cooldownUntil` timestamp,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `llm_circuit_breakers_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_leads_tenant_created` ON `leads` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_leads_tenant_status` ON `leads` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_leads_tenant_phonehash` ON `leads` (`tenantId`,`phoneHash`);--> statement-breakpoint
CREATE INDEX `idx_messages_tenant_lead_created` ON `messages` (`tenantId`,`leadId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_messages_tenant_twilio_sid` ON `messages` (`tenantId`,`twilioSid`);--> statement-breakpoint
CREATE INDEX `idx_messages_tenant_idempotency` ON `messages` (`tenantId`,`idempotencyKey`);--> statement-breakpoint
CREATE INDEX `idx_automations_tenant_enabled_trigger` ON `automations` (`tenantId`,`enabled`,`triggerType`);--> statement-breakpoint
CREATE INDEX `idx_usage_tenant_period` ON `usage` (`tenantId`,`periodStart`);--> statement-breakpoint
CREATE INDEX `idx_webhook_logs_tenant_created` ON `webhook_logs` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_system_error_logs_tenant_created` ON `system_error_logs` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_sms_rate_limits_tenant_window` ON `sms_rate_limits` (`tenantId`,`windowStart`);--> statement-breakpoint
CREATE INDEX `idx_llm_breakers_provider_model` ON `llm_circuit_breakers` (`provider`,`model`);--> statement-breakpoint
CREATE TABLE `webhook_receive_dedupes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `dedupeKey` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `webhook_receive_dedupes_id` PRIMARY KEY(`id`),
  UNIQUE KEY `webhook_receive_dedupes_tenant_dedupe_uidx` (`tenantId`,`dedupeKey`)
);
ALTER TABLE `users`
  ADD COLUMN `emailVerifiedAt` timestamp NULL;

CREATE TABLE `email_verification_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `tokenHash` varchar(255) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `email_verification_tokens_id` PRIMARY KEY(`id`)
);

CREATE TABLE `password_reset_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `tokenHash` varchar(255) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`)
);

CREATE TABLE `billing_invoices` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `subscriptionId` int NULL,
  `stripeInvoiceId` varchar(255) NOT NULL,
  `stripeChargeId` varchar(255) NULL,
  `number` varchar(128) NULL,
  `status` varchar(64) NOT NULL,
  `currency` varchar(16) NOT NULL,
  `subtotal` int NOT NULL DEFAULT 0,
  `total` int NOT NULL DEFAULT 0,
  `amountPaid` int NOT NULL DEFAULT 0,
  `amountRemaining` int NOT NULL DEFAULT 0,
  `hostedInvoiceUrl` varchar(500) NULL,
  `invoicePdfUrl` varchar(500) NULL,
  `periodStart` timestamp NULL,
  `periodEnd` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `billing_invoices_id` PRIMARY KEY(`id`),
  CONSTRAINT `billing_invoices_stripe_invoice_id_unique` UNIQUE(`stripeInvoiceId`)
);

CREATE TABLE `billing_refunds` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `subscriptionId` int NULL,
  `billingInvoiceId` int NULL,
  `stripeRefundId` varchar(255) NOT NULL,
  `stripeChargeId` varchar(255) NULL,
  `amount` int NOT NULL,
  `currency` varchar(16) NOT NULL,
  `reason` varchar(100) NULL,
  `status` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `billing_refunds_id` PRIMARY KEY(`id`),
  CONSTRAINT `billing_refunds_stripe_refund_id_unique` UNIQUE(`stripeRefundId`)
);

CREATE TABLE `automation_jobs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `automationId` int NOT NULL,
  `leadId` int NULL,
  `eventType` varchar(100) NOT NULL,
  `eventData` json NULL,
  `stepIndex` int NOT NULL DEFAULT 0,
  `nextRunAt` timestamp NOT NULL,
  `status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT 0,
  `lastError` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `automation_jobs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `admin_audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `adminUserId` int NOT NULL,
  `adminEmail` varchar(320) NULL,
  `action` varchar(120) NOT NULL,
  `targetTenantId` int NULL,
  `targetUserId` int NULL,
  `route` varchar(255) NULL,
  `metadata` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
CREATE TABLE `admin_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`adminEmail` varchar(320),
	`action` varchar(120) NOT NULL,
	`targetTenantId` int,
	`targetUserId` int,
	`route` varchar(255),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_rate_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_rate_limits_email_created_idx` UNIQUE(`email`,`createdAt`)
);
--> statement-breakpoint
CREATE TABLE `automation_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`automationId` int NOT NULL,
	`leadId` int,
	`eventType` varchar(100) NOT NULL,
	`eventData` json,
	`stepIndex` int NOT NULL DEFAULT 0,
	`nextRunAt` timestamp NOT NULL,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`subscriptionId` int,
	`stripeInvoiceId` varchar(255) NOT NULL,
	`stripeChargeId` varchar(255),
	`number` varchar(128),
	`status` varchar(64) NOT NULL,
	`currency` varchar(16) NOT NULL,
	`subtotal` int NOT NULL DEFAULT 0,
	`total` int NOT NULL DEFAULT 0,
	`amountPaid` int NOT NULL DEFAULT 0,
	`amountRemaining` int NOT NULL DEFAULT 0,
	`hostedInvoiceUrl` varchar(500),
	`invoicePdfUrl` varchar(500),
	`periodStart` timestamp,
	`periodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_invoices_stripeInvoiceId_unique` UNIQUE(`stripeInvoiceId`)
);
--> statement-breakpoint
CREATE TABLE `billing_refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`subscriptionId` int,
	`billingInvoiceId` int,
	`stripeRefundId` varchar(255) NOT NULL,
	`stripeChargeId` varchar(255),
	`amount` int NOT NULL,
	`currency` varchar(16) NOT NULL,
	`reason` varchar(100),
	`status` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_refunds_stripeRefundId_unique` UNIQUE(`stripeRefundId`)
);
--> statement-breakpoint
CREATE TABLE `email_verification_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_verification_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llm_circuit_breakers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(50) NOT NULL,
	`model` varchar(100) NOT NULL,
	`state` enum('closed','open','half_open') NOT NULL DEFAULT 'closed',
	`consecutiveFailures` int NOT NULL DEFAULT 0,
	`openedAt` timestamp,
	`cooldownUntil` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llm_circuit_breakers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_rate_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`windowStart` timestamp NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_rate_limits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_receive_dedupes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`dedupeKey` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_receive_dedupes_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_receive_dedupes_tenant_dedupe_uidx` UNIQUE(`tenantId`,`dedupeKey`)
);
--> statement-breakpoint
ALTER TABLE `automations` MODIFY COLUMN `category` enum('follow_up','reactivation','appointment','welcome','custom','no_show','cancellation','loyalty') NOT NULL DEFAULT 'custom';--> statement-breakpoint
ALTER TABLE `webhook_logs` MODIFY COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `automations` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `phoneHash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `smsConsentAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `smsConsentSource` varchar(100);--> statement-breakpoint
ALTER TABLE `leads` ADD `tcpaConsentText` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `unsubscribedAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `unsubscribeMethod` varchar(50);--> statement-breakpoint
ALTER TABLE `messages` ADD `provider` varchar(50);--> statement-breakpoint
ALTER TABLE `messages` ADD `providerError` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `retryCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `idempotencyKey` varchar(64);--> statement-breakpoint
ALTER TABLE `messages` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `messages` ADD `failedAt` timestamp;--> statement-breakpoint
ALTER TABLE `phone_numbers` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `templates` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_phone_hash_idx` UNIQUE(`tenantId`,`phoneHash`);--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_idempotency_key_idx` UNIQUE(`tenantId`,`idempotencyKey`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_idx` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_open_id_idx` UNIQUE(`openId`);--> statement-breakpoint
CREATE INDEX `leads_tenant_id_idx` ON `leads` (`tenantId`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `leads_created_at_idx` ON `leads` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `leads_search_idx` ON `leads` (`tenantId`,`phone`,`name`,`email`);--> statement-breakpoint
CREATE INDEX `leads_consent_idx` ON `leads` (`tenantId`,`smsConsentAt`);--> statement-breakpoint
CREATE INDEX `messages_tenant_id_idx` ON `messages` (`tenantId`);--> statement-breakpoint
CREATE INDEX `messages_lead_id_idx` ON `messages` (`leadId`);--> statement-breakpoint
CREATE INDEX `messages_tenant_lead_idx` ON `messages` (`tenantId`,`leadId`);--> statement-breakpoint
CREATE INDEX `messages_created_at_idx` ON `messages` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `users_tenant_id_idx` ON `users` (`tenantId`);CREATE TABLE `referral_payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`method` enum('paypal','stripe','bank_transfer') NOT NULL DEFAULT 'paypal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	`transactionId` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referral_payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`referrer_id` int NOT NULL,
	`referred_user_id` int NOT NULL,
	`referral_code` varchar(16) NOT NULL,
	`status` enum('pending','completed','expired','cancelled') NOT NULL DEFAULT 'pending',
	`subscription_id` varchar(255),
	`reward_amount` int NOT NULL DEFAULT 50,
	`reward_currency` varchar(3) NOT NULL DEFAULT 'USD',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`expires_at` timestamp NOT NULL,
	`payout_scheduled_at` timestamp,
	`payout_processed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`metadata` json,
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_referral_code_unique` UNIQUE(`referral_code`)
);
--> statement-breakpoint
CREATE TABLE `stripe_subscriptions` (
	`id` varchar(255) NOT NULL,
	`user_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`status` varchar(50) NOT NULL,
	`price_id` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`current_period_start` timestamp NOT NULL,
	`current_period_end` timestamp NOT NULL,
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`trial_end` timestamp,
	`canceled_at` timestamp,
	`ended_at` timestamp,
	`latest_invoice_id` varchar(255),
	`payment_method_id` varchar(255),
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `plans` ADD `revenueSharePercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `promotionalSlots` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `promotionalPriceCap` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `hasPromotion` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `isPromotional` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `promotionalExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `tenants` ADD `settings` json;--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_customer_id` varchar(255);--> statement-breakpoint
CREATE INDEX `idx_referrals_referrer_id` ON `referrals` (`referrer_id`);--> statement-breakpoint
CREATE INDEX `idx_referrals_referred_user_id` ON `referrals` (`referred_user_id`);--> statement-breakpoint
CREATE INDEX `idx_referrals_status` ON `referrals` (`status`);--> statement-breakpoint
CREATE INDEX `idx_referrals_expires_at` ON `referrals` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_referrals_payout_scheduled_at` ON `referrals` (`payout_scheduled_at`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_user_id` ON `stripe_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_tenant_id` ON `stripe_subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_customer_id` ON `stripe_subscriptions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_status` ON `stripe_subscriptions` (`status`);