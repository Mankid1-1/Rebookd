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
CREATE INDEX `users_tenant_id_idx` ON `users` (`tenantId`);