CREATE TABLE `referral_payouts` (
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