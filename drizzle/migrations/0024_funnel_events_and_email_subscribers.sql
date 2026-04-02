-- Funnel events: tracks visitor journey from landing to activation
CREATE TABLE IF NOT EXISTS `funnel_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sessionId` VARCHAR(64) NOT NULL,
  `eventName` VARCHAR(100) NOT NULL,
  `properties` JSON,
  `utmSource` VARCHAR(255),
  `utmMedium` VARCHAR(255),
  `utmCampaign` VARCHAR(255),
  `utmContent` VARCHAR(255),
  `utmTerm` VARCHAR(255),
  `referrer` VARCHAR(2048),
  `userId` INT,
  `pageUrl` VARCHAR(2048),
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX `funnel_session_idx` (`sessionId`),
  INDEX `funnel_event_idx` (`eventName`),
  INDEX `funnel_created_idx` (`createdAt`),
  INDEX `funnel_source_idx` (`utmSource`),
  INDEX `funnel_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email subscribers: pre-signup lead capture
CREATE TABLE IF NOT EXISTS `email_subscribers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(320) NOT NULL,
  `name` VARCHAR(255),
  `source` ENUM('roi_calculator', 'industry_page', 'blog', 'waitlist', 'footer') NOT NULL DEFAULT 'roi_calculator',
  `industry` VARCHAR(100),
  `roiData` JSON,
  `attribution` JSON,
  `status` ENUM('active', 'unsubscribed', 'bounced') NOT NULL DEFAULT 'active',
  `subscribedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `unsubscribedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE INDEX `email_sub_email_idx` (`email`),
  INDEX `email_sub_source_idx` (`source`),
  INDEX `email_sub_status_idx` (`status`),
  INDEX `email_sub_industry_idx` (`industry`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email sequence queue: drip campaign scheduling
CREATE TABLE IF NOT EXISTS `email_sequence_queue` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `subscriberId` INT NOT NULL,
  `sequenceName` VARCHAR(100) NOT NULL,
  `stepIndex` INT NOT NULL DEFAULT 0,
  `scheduledAt` TIMESTAMP NOT NULL,
  `sentAt` TIMESTAMP NULL,
  `status` ENUM('pending', 'sent', 'skipped', 'failed') NOT NULL DEFAULT 'pending',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX `seq_queue_scheduled_idx` (`status`, `scheduledAt`),
  INDEX `seq_queue_subscriber_idx` (`subscriberId`),
  CONSTRAINT `fk_seq_subscriber` FOREIGN KEY (`subscriberId`) REFERENCES `email_subscribers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
