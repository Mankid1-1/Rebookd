-- 0022: Add call forwarding fields to phone_numbers for tracking number system
-- Enables automatic call tracking: all calls route through tracking number, get logged, then forward

ALTER TABLE `phone_numbers`
  ADD COLUMN `forwardTo` varchar(20) NULL COMMENT 'Business phone to forward inbound calls to' AFTER `isInbound`,
  ADD COLUMN `type` enum('tracking','business','personal') NOT NULL DEFAULT 'business' COMMENT 'tracking = provisioned Twilio/Telnyx number for call logging' AFTER `forwardTo`,
  ADD COLUMN `provider` varchar(50) NULL COMMENT 'twilio or telnyx' AFTER `type`,
  ADD COLUMN `capabilities` json NULL COMMENT '{"voice":true,"sms":true,"mms":false}' AFTER `provider`,
  ADD COLUMN `monthlyFee` int NULL COMMENT 'Monthly cost in cents' AFTER `capabilities`,
  ADD COLUMN `status` enum('active','suspended','released') NOT NULL DEFAULT 'active' AFTER `monthlyFee`;

CREATE INDEX `idx_phone_numbers_type` ON `phone_numbers` (`tenantId`, `type`);
