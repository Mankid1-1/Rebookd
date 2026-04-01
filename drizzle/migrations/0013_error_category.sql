-- Migration 0013: Add errorCategory column to system_error_logs
-- Allows sentinel to distinguish graphical/performance issues from runtime errors
-- and route them to admin escalation instead of the code repair pipeline.

ALTER TABLE `system_error_logs`
  ADD COLUMN `errorCategory` ENUM('runtime','graphical','rendering','network','performance')
  NOT NULL DEFAULT 'runtime'
  AFTER `severity`;

CREATE INDEX `sel_category_idx` ON `system_error_logs` (`errorCategory`);
