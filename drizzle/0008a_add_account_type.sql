ALTER TABLE `users` ADD COLUMN `accountType` enum('business','referral') NOT NULL DEFAULT 'business';
