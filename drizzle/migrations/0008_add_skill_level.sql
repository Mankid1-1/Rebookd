-- Add skill level to users for adaptive UI experience
ALTER TABLE `users` ADD COLUMN `skillLevel` enum('basic','intermediate','advanced') DEFAULT 'basic' AFTER `tenantRole`;
ALTER TABLE `users` ADD COLUMN `skillLevelSetAt` timestamp NULL AFTER `skillLevel`;
