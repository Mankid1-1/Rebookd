-- Link Tokens: validates booking/review URLs sent via SMS automations
-- Prevents token forgery by tracking, expiring, and single-use enforcement

CREATE TABLE IF NOT EXISTS `link_tokens` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `leadId` int NOT NULL,
  `token` varchar(64) NOT NULL,
  `type` enum('booking','review') NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX `lt_token_idx` (`token`),
  INDEX `lt_tenant_lead_idx` (`tenantId`, `leadId`),
  INDEX `lt_expires_idx` (`expiresAt`),
  CONSTRAINT `lt_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`),
  CONSTRAINT `lt_lead_fk` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`)
);
