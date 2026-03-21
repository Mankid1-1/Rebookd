CREATE TABLE `webhook_receive_dedupes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `dedupeKey` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `webhook_receive_dedupes_id` PRIMARY KEY(`id`),
  UNIQUE KEY `webhook_receive_dedupes_tenant_dedupe_uidx` (`tenantId`,`dedupeKey`)
);
