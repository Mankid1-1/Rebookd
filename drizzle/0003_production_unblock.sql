ALTER TABLE `leads` ADD `phoneHash` varchar(64) NOT NULL DEFAULT '';--> statement-breakpoint
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
