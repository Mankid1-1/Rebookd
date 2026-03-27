-- Feature configs: per-tenant, per-feature JSON configuration
CREATE TABLE IF NOT EXISTS `feature_configs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `feature` varchar(100) NOT NULL,
  `config` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `feature_configs_id` PRIMARY KEY(`id`),
  CONSTRAINT `feature_configs_tenant_feature_idx` UNIQUE(`tenantId`, `feature`)
);

CREATE INDEX `feature_configs_tenant_id_idx` ON `feature_configs` (`tenantId`);
