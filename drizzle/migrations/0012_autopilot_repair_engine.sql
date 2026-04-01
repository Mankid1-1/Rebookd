-- Autopilot Repair Engine: repair_jobs table + systemErrorLogs extensions

-- Extend system_error_logs with fingerprint and severity
ALTER TABLE `system_error_logs`
  ADD COLUMN `stackTraceHash` VARCHAR(64) NULL,
  ADD COLUMN `severity` ENUM('low','medium','high','critical') DEFAULT 'medium',
  ADD INDEX `sel_stack_trace_hash_idx` (`stackTraceHash`),
  ADD INDEX `sel_resolved_idx` (`resolved`),
  ADD INDEX `sel_severity_idx` (`severity`);

-- Create repair_jobs table
CREATE TABLE `repair_jobs` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `errorLogId` INT NOT NULL,
  `errorFingerprint` VARCHAR(64) NOT NULL,
  `status` ENUM('detected','diagnosing','patching','testing','verifying','deployed','failed','escalated') NOT NULL DEFAULT 'detected',
  `branchName` VARCHAR(200) NULL,
  `errorType` VARCHAR(50) NULL,
  `errorMessage` TEXT NULL,
  `affectedFile` VARCHAR(500) NULL,
  `claudeOutput` TEXT NULL,
  `diffPatch` TEXT NULL,
  `testResults` TEXT NULL,
  `failureReason` TEXT NULL,
  `attemptCount` INT NOT NULL DEFAULT 0,
  `maxAttempts` INT NOT NULL DEFAULT 3,
  `triggeredBy` ENUM('sentinel','manual') NOT NULL DEFAULT 'sentinel',
  `detectedAt` TIMESTAMP NULL,
  `diagnosisStartedAt` TIMESTAMP NULL,
  `patchStartedAt` TIMESTAMP NULL,
  `testStartedAt` TIMESTAMP NULL,
  `verifyStartedAt` TIMESTAMP NULL,
  `completedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `rj_error_log_idx` (`errorLogId`),
  INDEX `rj_fingerprint_idx` (`errorFingerprint`),
  INDEX `rj_status_idx` (`status`),
  INDEX `rj_created_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
