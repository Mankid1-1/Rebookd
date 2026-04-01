-- Add birthday, visitCount, loyaltyTier, and timezone to leads table
-- These fields enable per-lead retention tracking, birthday automations,
-- and timezone-aware after-hours logic.

ALTER TABLE `leads`
  ADD COLUMN `birthday` DATE NULL AFTER `appointmentAt`,
  ADD COLUMN `visitCount` INT NOT NULL DEFAULT 0 AFTER `birthday`,
  ADD COLUMN `loyaltyTier` VARCHAR(50) NULL AFTER `visitCount`,
  ADD COLUMN `timezone` VARCHAR(64) NULL AFTER `loyaltyTier`;

-- Index for birthday automation queries (find leads with birthdays this week)
CREATE INDEX `leads_birthday_idx` ON `leads` (`tenantId`, `birthday`);

-- Index for loyalty milestone queries (find leads at specific visit counts)
CREATE INDEX `leads_visit_count_idx` ON `leads` (`tenantId`, `visitCount`);
