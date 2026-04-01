-- Migration 0015: Add missing FK constraints + consolidate stripe_subscriptions into subscriptions
-- WARNING: Before applying, verify no orphan rows exist that would violate FK constraints.
-- Run orphan checks first:
--   SELECT COUNT(*) FROM email_verification_tokens evt LEFT JOIN users u ON evt.userId = u.id WHERE u.id IS NULL;
--   (repeat for each FK relationship)

-- ═══ PART 1: Add missing foreign key constraints ═══

-- Token tables → users
ALTER TABLE `email_verification_tokens`
  ADD CONSTRAINT `fk_evt_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`);

ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `fk_prt_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`);

ALTER TABLE `mfa_session_tokens`
  ADD CONSTRAINT `fk_mfa_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`);

-- Users → tenants (nullable)
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Tenant invitations → tenants
ALTER TABLE `tenant_invitations`
  ADD CONSTRAINT `fk_ti_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Billing invoices → tenants, subscriptions
ALTER TABLE `billing_invoices`
  ADD CONSTRAINT `fk_bi_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  ADD CONSTRAINT `fk_bi_subscription` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`);

-- Billing refunds → tenants, subscriptions, invoices
ALTER TABLE `billing_refunds`
  ADD CONSTRAINT `fk_br_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  ADD CONSTRAINT `fk_br_subscription` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`),
  ADD CONSTRAINT `fk_br_invoice` FOREIGN KEY (`billingInvoiceId`) REFERENCES `billing_invoices`(`id`);

-- Usage → tenants
ALTER TABLE `usage`
  ADD CONSTRAINT `fk_usage_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Phone numbers → tenants
ALTER TABLE `phone_numbers`
  ADD CONSTRAINT `fk_pn_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Leads → tenants
ALTER TABLE `leads`
  ADD CONSTRAINT `fk_leads_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Messages → automations (tenantId, leadId FKs already exist)
ALTER TABLE `messages`
  ADD CONSTRAINT `fk_msg_automation` FOREIGN KEY (`automationId`) REFERENCES `automations`(`id`);

-- Templates → tenants
ALTER TABLE `templates`
  ADD CONSTRAINT `fk_templates_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Automations → tenants
ALTER TABLE `automations`
  ADD CONSTRAINT `fk_automations_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Automation logs — skipped: table is named `automation_jobs` in production,
-- and already has FKs (automation_jobs_ibfk_1/2/3).

-- AI message logs → tenants, leads
ALTER TABLE `ai_message_logs`
  ADD CONSTRAINT `fk_aiml_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  ADD CONSTRAINT `fk_aiml_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`);

-- Webhook logs → tenants (nullable)
ALTER TABLE `webhook_logs`
  ADD CONSTRAINT `fk_wl_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- API keys → tenants
ALTER TABLE `api_keys`
  ADD CONSTRAINT `fk_ak_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- System error logs → tenants (nullable)
ALTER TABLE `system_error_logs`
  ADD CONSTRAINT `fk_sel_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Admin audit logs → users (admin, target), tenants
ALTER TABLE `admin_audit_logs`
  ADD CONSTRAINT `fk_aal_admin` FOREIGN KEY (`adminUserId`) REFERENCES `users`(`id`),
  ADD CONSTRAINT `fk_aal_target_tenant` FOREIGN KEY (`targetTenantId`) REFERENCES `tenants`(`id`),
  ADD CONSTRAINT `fk_aal_target_user` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`);

-- SMS rate limits → tenants
ALTER TABLE `sms_rate_limits`
  ADD CONSTRAINT `fk_srl_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Webhook receive dedupes → tenants
ALTER TABLE `webhook_receive_dedupes`
  ADD CONSTRAINT `fk_wrd_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Recovery events → tenants, leads, automations, messages
ALTER TABLE `recovery_events`
  ADD CONSTRAINT `fk_re_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  ADD CONSTRAINT `fk_re_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`),
  ADD CONSTRAINT `fk_re_automation` FOREIGN KEY (`automationId`) REFERENCES `automations`(`id`),
  ADD CONSTRAINT `fk_re_message` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`);

-- Feature configs → tenants — skipped: has tenantId=0 global default row (same pattern as sentinel).
-- ALTER TABLE `feature_configs`
--   ADD CONSTRAINT `fk_fc_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Calendar connections → tenants
ALTER TABLE `calendar_connections`
  ADD CONSTRAINT `fk_cc_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Contact imports → tenants
ALTER TABLE `contact_imports`
  ADD CONSTRAINT `fk_ci_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Lead segments → tenants
ALTER TABLE `lead_segments`
  ADD CONSTRAINT `fk_ls_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`);

-- Lead segment members → segments, leads
ALTER TABLE `lead_segment_members`
  ADD CONSTRAINT `fk_lsm_segment` FOREIGN KEY (`segmentId`) REFERENCES `lead_segments`(`id`),
  ADD CONSTRAINT `fk_lsm_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`);

-- Lead automation overrides → leads
ALTER TABLE `lead_automation_overrides`
  ADD CONSTRAINT `fk_lao_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`);

-- Stripe subscriptions (deprecated) → users, tenants
ALTER TABLE `stripe_subscriptions`
  ADD CONSTRAINT `fk_ss_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  ADD CONSTRAINT `fk_ss_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`);

-- ═══ PART 2: Consolidate stripe_subscriptions columns into subscriptions ═══

ALTER TABLE `subscriptions`
  ADD COLUMN `userId` int NULL AFTER `planId`,
  ADD COLUMN `stripePriceId` varchar(255) NULL,
  ADD COLUMN `stripeQuantity` int DEFAULT 1,
  ADD COLUMN `cancelAtPeriodEnd` boolean DEFAULT false,
  ADD COLUMN `canceledAt` timestamp NULL,
  ADD COLUMN `endedAt` timestamp NULL,
  ADD COLUMN `latestInvoiceId` varchar(255) NULL,
  ADD COLUMN `paymentMethodId` varchar(255) NULL,
  ADD COLUMN `stripeMetadata` json NULL,
  ADD CONSTRAINT `fk_sub_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`);

-- Migrate data from stripe_subscriptions into subscriptions
UPDATE `subscriptions` s
INNER JOIN `stripe_subscriptions` ss ON s.`stripeSubscriptionId` = ss.`id`
SET
  s.`userId` = ss.`user_id`,
  s.`stripePriceId` = ss.`price_id`,
  s.`stripeQuantity` = ss.`quantity`,
  s.`cancelAtPeriodEnd` = ss.`cancel_at_period_end`,
  s.`canceledAt` = ss.`canceled_at`,
  s.`endedAt` = ss.`ended_at`,
  s.`latestInvoiceId` = ss.`latest_invoice_id`,
  s.`paymentMethodId` = ss.`payment_method_id`,
  s.`stripeMetadata` = ss.`metadata`;

-- NOTE: stripe_subscriptions table is NOT dropped yet.
-- Drop it in a future migration after verifying consolidation is stable.
-- DROP TABLE `stripe_subscriptions`;
