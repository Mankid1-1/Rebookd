-- Migration: 0023_upgrade_features
-- Adds tables for: AI SMS experiments, Smart Review Routing, Booking Pages, Waiting List Auto-Fill
-- Also extends link_tokens type enum and adds generationMethod to messages

-- 1. Extend link_tokens type enum
ALTER TABLE `link_tokens` MODIFY COLUMN `type` ENUM('booking', 'review', 'feedback', 'booking_page') NOT NULL;

-- 2. Add generationMethod to messages
ALTER TABLE `messages` ADD COLUMN `generationMethod` ENUM('template', 'ai', 'manual') NOT NULL DEFAULT 'template' AFTER `tone`;

-- 3. AI SMS Experiments (Feature 2)
CREATE TABLE `ai_sms_experiments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `automationKey` varchar(100) NOT NULL,
  `trafficPercent` int NOT NULL DEFAULT 50,
  `status` ENUM('draft', 'running', 'paused', 'completed') NOT NULL DEFAULT 'draft',
  `startedAt` timestamp NULL,
  `endedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  INDEX `idx_aismsexp_tenant` (`tenantId`),
  INDEX `idx_aismsexp_tenant_key` (`tenantId`, `automationKey`),
  INDEX `idx_aismsexp_status` (`status`)
);

CREATE TABLE `ai_sms_results` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `experimentId` int NOT NULL,
  `tenantId` int NOT NULL,
  `leadId` int NOT NULL,
  `messageId` int NOT NULL,
  `variant` ENUM('template', 'ai') NOT NULL,
  `generationMethod` ENUM('llm', 'template_fallback') NOT NULL DEFAULT 'llm',
  `promptTokens` int NULL,
  `completionTokens` int NULL,
  `latencyMs` int NULL,
  `replied` boolean NOT NULL DEFAULT false,
  `converted` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`experimentId`) REFERENCES `ai_sms_experiments`(`id`),
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`),
  FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`),
  INDEX `idx_aismsr_experiment` (`experimentId`),
  INDEX `idx_aismsr_tenant_variant` (`tenantId`, `variant`)
);

-- 4. Review Requests (Feature 1)
CREATE TABLE `review_requests` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `leadId` int NOT NULL,
  `messageId` int NULL,
  `token` varchar(64) NOT NULL UNIQUE,
  `status` ENUM('sent', 'rated', 'review_clicked', 'feedback_submitted', 'expired') NOT NULL DEFAULT 'sent',
  `rating` int NULL,
  `feedbackText` text NULL,
  `reviewPlatform` varchar(50) NULL,
  `reviewLinkClicked` boolean NOT NULL DEFAULT false,
  `expiresAt` timestamp NOT NULL,
  `ratedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`),
  INDEX `idx_revreq_tenant` (`tenantId`),
  INDEX `idx_revreq_tenant_lead` (`tenantId`, `leadId`),
  INDEX `idx_revreq_tenant_status` (`tenantId`, `status`)
);

-- 5. Booking Pages (Feature 4)
CREATE TABLE `booking_pages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `slug` varchar(100) NOT NULL UNIQUE,
  `title` varchar(255) NOT NULL,
  `description` text NULL,
  `services` json NULL,
  `businessHours` json NULL,
  `slotDurationMinutes` int NOT NULL DEFAULT 30,
  `bufferMinutes` int NOT NULL DEFAULT 0,
  `maxAdvanceDays` int NOT NULL DEFAULT 30,
  `brandColor` varchar(7) NULL,
  `logoUrl` varchar(500) NULL,
  `confirmationMessage` text NULL,
  `calendarConnectionId` int NULL,
  `enabled` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`calendarConnectionId`) REFERENCES `calendar_connections`(`id`),
  INDEX `idx_bookpg_tenant` (`tenantId`)
);

CREATE TABLE `public_bookings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `bookingPageId` int NOT NULL,
  `leadId` int NULL,
  `linkTokenId` int NULL,
  `clientName` varchar(255) NULL,
  `clientPhone` varchar(20) NULL,
  `clientEmail` varchar(320) NULL,
  `serviceName` varchar(255) NULL,
  `slotStart` timestamp NOT NULL,
  `slotEnd` timestamp NOT NULL,
  `status` ENUM('confirmed', 'cancelled', 'rescheduled', 'no_show', 'completed') NOT NULL DEFAULT 'confirmed',
  `calendarEventId` int NULL,
  `source` ENUM('sms_link', 'direct', 'qr_code', 'website') NOT NULL DEFAULT 'direct',
  `confirmationSentAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`bookingPageId`) REFERENCES `booking_pages`(`id`),
  FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`),
  INDEX `idx_pubbk_tenant_status` (`tenantId`, `status`),
  INDEX `idx_pubbk_page` (`bookingPageId`),
  INDEX `idx_pubbk_lead` (`leadId`),
  INDEX `idx_pubbk_slot` (`slotStart`)
);

-- 6. Waiting List (Feature 3)
CREATE TABLE `waiting_list_entries` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `leadId` int NOT NULL,
  `preferredDay` varchar(10) NULL,
  `preferredTimeStart` varchar(5) NULL,
  `preferredTimeEnd` varchar(5) NULL,
  `serviceType` varchar(100) NULL,
  `priority` int NOT NULL DEFAULT 0,
  `status` ENUM('active', 'offered', 'booked', 'expired', 'removed') NOT NULL DEFAULT 'active',
  `notes` text NULL,
  `expiresAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`),
  INDEX `idx_wle_tenant_status` (`tenantId`, `status`),
  INDEX `idx_wle_tenant_day` (`tenantId`, `preferredDay`),
  INDEX `idx_wle_tenant_priority` (`tenantId`, `priority`)
);

CREATE TABLE `waitlist_offers` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `waitlistEntryId` int NOT NULL,
  `leadId` int NOT NULL,
  `cancelledEventId` int NULL,
  `slotStart` timestamp NOT NULL,
  `slotEnd` timestamp NOT NULL,
  `messageId` int NULL,
  `status` ENUM('sent', 'accepted', 'declined', 'expired', 'slot_filled') NOT NULL DEFAULT 'sent',
  `responseDeadline` timestamp NOT NULL,
  `respondedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`waitlistEntryId`) REFERENCES `waiting_list_entries`(`id`),
  FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`),
  INDEX `idx_wlo_tenant_status` (`tenantId`, `status`),
  INDEX `idx_wlo_tenant_event` (`tenantId`, `cancelledEventId`),
  INDEX `idx_wlo_deadline` (`responseDeadline`)
);
