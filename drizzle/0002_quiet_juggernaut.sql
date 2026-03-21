ALTER TABLE `automations` MODIFY COLUMN `triggerConfig` json;--> statement-breakpoint
ALTER TABLE `automations` MODIFY COLUMN `conditions` json;--> statement-breakpoint
ALTER TABLE `automations` MODIFY COLUMN `actions` json;--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `plans` MODIFY COLUMN `features` json;--> statement-breakpoint
ALTER TABLE `templates` MODIFY COLUMN `variables` json;--> statement-breakpoint
ALTER TABLE `automations` ADD `errorCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `stripePriceId` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `trialReminderSent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `usage` ADD `hasUsageAlerted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);