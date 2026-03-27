-- Recovery Attribution: tracks every recovery attempt from SMS to bank deposit
CREATE TABLE IF NOT EXISTS `recovery_events` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `leadId` int NOT NULL,
  `automationId` int,
  `messageId` int,
  `originalAppointmentId` varchar(255),
  `recoveredAppointmentId` varchar(255),
  `leakageType` varchar(100) NOT NULL,
  `status` enum('sent','responded','converted','realized','manual_realized','failed','expired') NOT NULL DEFAULT 'sent',
  `trackingToken` varchar(64) NOT NULL,
  `stripePaymentIntentId` varchar(255),
  `stripeInvoiceId` varchar(255),
  `estimatedRevenue` int NOT NULL DEFAULT 0,
  `realizedRevenue` int NOT NULL DEFAULT 0,
  `attributionModel` varchar(50) NOT NULL DEFAULT 'last_touch',
  `isPrimaryAttribution` boolean NOT NULL DEFAULT false,
  `notes` text,
  `sentAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `respondedAt` timestamp NULL,
  `convertedAt` timestamp NULL,
  `realizedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX `recovery_events_tracking_token_idx` (`trackingToken`),
  INDEX `recovery_events_tenant_idx` (`tenantId`),
  INDEX `recovery_events_lead_idx` (`tenantId`, `leadId`),
  INDEX `recovery_events_status_idx` (`tenantId`, `status`),
  INDEX `recovery_events_automation_idx` (`tenantId`, `automationId`),
  INDEX `recovery_events_realized_at_idx` (`tenantId`, `realizedAt`)
);

-- Add recoveryEventId to messages table for linking
ALTER TABLE `messages` ADD COLUMN `recoveryEventId` int NULL AFTER `automationId`;
ALTER TABLE `messages` ADD INDEX `messages_recovery_event_idx` (`recoveryEventId`);

-- Add recoverySource to leads table for tracking how a lead was recovered
ALTER TABLE `leads` ADD COLUMN `recoverySource` varchar(100) NULL AFTER `unsubscribeMethod`;
ALTER TABLE `leads` ADD COLUMN `recoveredFromLeadId` int NULL AFTER `recoverySource`;
