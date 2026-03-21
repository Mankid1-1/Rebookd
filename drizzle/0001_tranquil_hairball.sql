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
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;