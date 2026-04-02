-- 0021: Call Logs — Voice call tracking for Twilio, Telnyx, Google Voice (manual), generic webhook
-- Supports inbound/outbound call tracking with duration, status, provider attribution, and lead matching

CREATE TABLE IF NOT EXISTS `call_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `leadId` int NULL,
  `direction` enum('inbound','outbound') NOT NULL,
  `callerNumber` varchar(20) NOT NULL,
  `calledNumber` varchar(20) NOT NULL,
  `status` enum('ringing','in_progress','completed','missed','voicemail','failed','busy','no_answer') NOT NULL DEFAULT 'ringing',
  `duration` int NOT NULL DEFAULT 0 COMMENT 'Call duration in seconds',
  `startedAt` timestamp NULL,
  `answeredAt` timestamp NULL,
  `endedAt` timestamp NULL,
  `provider` varchar(50) NOT NULL COMMENT 'twilio, telnyx, google_voice, manual, webhook',
  `providerCallSid` varchar(100) NULL COMMENT 'External call ID for webhook deduplication',
  `recordingUrl` text NULL,
  `transcription` text NULL,
  `notes` text NULL,
  `cost` int NULL COMMENT 'Call cost in cents',
  `tags` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT `fk_call_logs_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_call_logs_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Performance indexes
CREATE INDEX `idx_call_logs_tenant` ON `call_logs` (`tenantId`);
CREATE INDEX `idx_call_logs_tenant_direction` ON `call_logs` (`tenantId`, `direction`);
CREATE INDEX `idx_call_logs_tenant_status` ON `call_logs` (`tenantId`, `status`);
CREATE INDEX `idx_call_logs_tenant_created` ON `call_logs` (`tenantId`, `createdAt`);
CREATE INDEX `idx_call_logs_tenant_lead` ON `call_logs` (`tenantId`, `leadId`);

-- Dedup: prevent duplicate webhook events for the same call
CREATE UNIQUE INDEX `idx_call_logs_provider_sid` ON `call_logs` (`tenantId`, `providerCallSid`);
