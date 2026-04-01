-- n8n Dead Letter Queue: stores events that failed all retry attempts
CREATE TABLE IF NOT EXISTS `n8n_dead_letter_queue` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `eventId` varchar(100),
  `eventType` varchar(100) NOT NULL,
  `payload` json NOT NULL,
  `errorMessage` text,
  `attempts` int NOT NULL DEFAULT 0,
  `maxAttempts` int NOT NULL DEFAULT 5,
  `status` enum('pending', 'reprocessing', 'succeeded', 'exhausted') NOT NULL DEFAULT 'pending',
  `lastAttemptAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_dlq_status` (`status`, `createdAt`),
  INDEX `idx_dlq_tenant` (`tenantId`),
  CONSTRAINT `fk_dlq_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
);

-- n8n Workflow Sync: tracks sync state between Rebooked registry and n8n
CREATE TABLE IF NOT EXISTS `n8n_workflow_sync` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `workflowKey` varchar(100) NOT NULL,
  `n8nWorkflowId` varchar(50),
  `n8nActive` boolean NOT NULL DEFAULT false,
  `lastSyncAt` timestamp NULL,
  `syncStatus` enum('synced', 'drift_detected', 'missing_in_n8n', 'unknown_in_rebooked') NOT NULL DEFAULT 'synced',
  `n8nVersion` int NOT NULL DEFAULT 0,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_workflow_key` (`workflowKey`),
  INDEX `idx_sync_status` (`syncStatus`)
);

-- Performance index for n8n analytics queries
CREATE INDEX `idx_autolog_key_status_date` ON `automation_logs` (`automationKey`, `status`, `createdAt`);
