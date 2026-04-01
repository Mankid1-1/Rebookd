-- ============================================================================
-- Migration 0010: Automation Logs Table + Recovery Commission Columns
--
-- Purpose:
--   1. Create automation_logs table for comprehensive audit trail of every
--      automation execution (TCPA blocks, successes, failures, state transitions)
--   2. Add commission tracking columns to recovery_events for 15% revenue share
-- ============================================================================

-- ─── Automation Logs Table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `automation_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `automationId` int NOT NULL,
  `automationKey` varchar(100) NOT NULL,
  `leadId` int NULL,
  `eventType` varchar(100) NOT NULL,
  `stepIndex` int NOT NULL DEFAULT 0,
  `stepType` varchar(50) NOT NULL,
  `status` enum('started','completed','failed','skipped','tcpa_blocked') NOT NULL DEFAULT 'started',
  `recoveryState` enum('detected','contacted','recovered','billed') NULL,
  `recoveryEventId` int NULL,
  `durationMs` int NULL,
  `errorMessage` text NULL,
  `metadata` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_autolog_tenant_automation` (`tenantId`, `automationId`),
  INDEX `idx_autolog_tenant_lead` (`tenantId`, `leadId`),
  INDEX `idx_autolog_tenant_status` (`tenantId`, `status`),
  INDEX `idx_autolog_tenant_recovery` (`tenantId`, `recoveryState`),
  INDEX `idx_autolog_tenant_created` (`tenantId`, `createdAt`)
);

-- ─── Commission Tracking on Recovery Events ──────────────────────────────────

ALTER TABLE `recovery_events`
  ADD COLUMN `commissionRate` decimal(5,4) NOT NULL DEFAULT 0.1500 AFTER `isPrimaryAttribution`,
  ADD COLUMN `commissionAmount` int NOT NULL DEFAULT 0 AFTER `commissionRate`,
  ADD COLUMN `commissionStatus` enum('pending','invoiced','paid') NOT NULL DEFAULT 'pending' AFTER `commissionAmount`,
  ADD COLUMN `commissionInvoiceId` varchar(255) NULL AFTER `commissionStatus`;
