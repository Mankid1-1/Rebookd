-- Persistent webhook event audit logging for compliance
CREATE TABLE IF NOT EXISTS `webhook_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stripeEventId` varchar(255),
  `eventType` varchar(100) NOT NULL,
  `status` enum('processed','failed','skipped') NOT NULL,
  `objectId` varchar(255),
  `error` text,
  `payload` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `webhook_events_stripe_event_idx` (`stripeEventId`),
  INDEX `webhook_events_type_idx` (`eventType`),
  INDEX `webhook_events_status_idx` (`status`),
  INDEX `webhook_events_created_idx` (`createdAt`)
) ENGINE=InnoDB;
