ALTER TABLE `users`
  ADD COLUMN `emailVerifiedAt` timestamp NULL;

CREATE TABLE `email_verification_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `tokenHash` varchar(255) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `email_verification_tokens_id` PRIMARY KEY(`id`)
);

CREATE TABLE `password_reset_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `tokenHash` varchar(255) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`)
);

CREATE TABLE `billing_invoices` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `subscriptionId` int NULL,
  `stripeInvoiceId` varchar(255) NOT NULL,
  `stripeChargeId` varchar(255) NULL,
  `number` varchar(128) NULL,
  `status` varchar(64) NOT NULL,
  `currency` varchar(16) NOT NULL,
  `subtotal` int NOT NULL DEFAULT 0,
  `total` int NOT NULL DEFAULT 0,
  `amountPaid` int NOT NULL DEFAULT 0,
  `amountRemaining` int NOT NULL DEFAULT 0,
  `hostedInvoiceUrl` varchar(500) NULL,
  `invoicePdfUrl` varchar(500) NULL,
  `periodStart` timestamp NULL,
  `periodEnd` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `billing_invoices_id` PRIMARY KEY(`id`),
  CONSTRAINT `billing_invoices_stripe_invoice_id_unique` UNIQUE(`stripeInvoiceId`)
);

CREATE TABLE `billing_refunds` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `subscriptionId` int NULL,
  `billingInvoiceId` int NULL,
  `stripeRefundId` varchar(255) NOT NULL,
  `stripeChargeId` varchar(255) NULL,
  `amount` int NOT NULL,
  `currency` varchar(16) NOT NULL,
  `reason` varchar(100) NULL,
  `status` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `billing_refunds_id` PRIMARY KEY(`id`),
  CONSTRAINT `billing_refunds_stripe_refund_id_unique` UNIQUE(`stripeRefundId`)
);

CREATE TABLE `automation_jobs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `automationId` int NOT NULL,
  `leadId` int NULL,
  `eventType` varchar(100) NOT NULL,
  `eventData` json NULL,
  `stepIndex` int NOT NULL DEFAULT 0,
  `nextRunAt` timestamp NOT NULL,
  `status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT 0,
  `lastError` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `automation_jobs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `admin_audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `adminUserId` int NOT NULL,
  `adminEmail` varchar(320) NULL,
  `action` varchar(120) NOT NULL,
  `targetTenantId` int NULL,
  `targetUserId` int NULL,
  `route` varchar(255) NULL,
  `metadata` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
