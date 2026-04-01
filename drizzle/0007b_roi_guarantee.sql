-- ROI Guarantee: Add guarantee tracking fields to subscriptions
ALTER TABLE `subscriptions`
  ADD COLUMN `guaranteeCohort` ENUM('risk_free_20', 'flex_10') DEFAULT NULL,
  ADD COLUMN `guaranteeStatus` ENUM('active', 'satisfied', 'refunded', 'expired') DEFAULT NULL,
  ADD COLUMN `guaranteeStartedAt` TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN `guaranteeExpiresAt` TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN `lastRoiCheckAt` TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN `lastRoiAmount` INT DEFAULT NULL;

-- Add index for guarantee queries
CREATE INDEX `subscriptions_guarantee_idx` ON `subscriptions` (`guaranteeCohort`, `guaranteeStatus`);

-- Fix plan slugs: ensure Professional plan exists with correct revenue share
-- The CLAUDE.md spec requires $199/month + 15% revenue share as the main product
INSERT INTO `plans` (`name`, `slug`, `priceMonthly`, `maxAutomations`, `maxMessages`, `maxSeats`, `revenueSharePercent`, `promotionalSlots`, `hasPromotion`, `features`)
VALUES ('Professional', 'professional', 19900, 9999, 999999, 5, 15, 20, true, '["Everything in Growth", "Unlimited automations", "15% revenue share", "ROI guarantee eligible", "Priority support"]')
ON DUPLICATE KEY UPDATE
  `priceMonthly` = 19900,
  `revenueSharePercent` = 15,
  `promotionalSlots` = 20,
  `hasPromotion` = true,
  `features` = '["Everything in Growth", "Unlimited automations", "15% revenue share", "ROI guarantee eligible", "Priority support"]';

-- Add Flex plan for first 10 customers (20% revenue share — lower base, higher share)
INSERT INTO `plans` (`name`, `slug`, `priceMonthly`, `maxAutomations`, `maxMessages`, `maxSeats`, `revenueSharePercent`, `promotionalSlots`, `hasPromotion`, `features`)
VALUES ('Flex', 'flex', 9900, 9999, 999999, 3, 20, 10, true, '["All Professional features", "Reduced base fee", "20% revenue share", "ROI guarantee eligible", "First 10 customers only"]')
ON DUPLICATE KEY UPDATE
  `priceMonthly` = 9900,
  `revenueSharePercent` = 20,
  `promotionalSlots` = 10,
  `hasPromotion` = true,
  `features` = '["All Professional features", "Reduced base fee", "20% revenue share", "ROI guarantee eligible", "First 10 customers only"]';

-- Update existing plans with revenue share rates
UPDATE `plans` SET `revenueSharePercent` = 0 WHERE `slug` = 'starter';
UPDATE `plans` SET `revenueSharePercent` = 10 WHERE `slug` = 'growth';
UPDATE `plans` SET `revenueSharePercent` = 15 WHERE `slug` = 'scale';
