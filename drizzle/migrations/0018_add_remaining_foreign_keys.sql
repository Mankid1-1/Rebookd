-- Migration 0018: Add missing FK constraints for tables missed by 0015
--
-- Tables covered:
--   repair_jobs, automation_logs, calendar_events, calendar_sync_log,
--   referrals, referral_payouts
--
-- Pre-flight orphan check: all 0 except referrals.referred_user_id=0 (fixed below)
-- Tables intentionally skipped (no FK needed):
--   webhook_events (standalone Stripe event log, no tenant column)
--   deployments (standalone deployment log)
--   llm_circuit_breakers (standalone circuit breaker state)
--   sentinel_metrics / sentinel_baselines (use tenantId=0 for global, same as feature_configs)
--   feature_configs (uses tenantId=0 for sentinel flags)

-- ═══ Fix orphan data before adding FK constraints ═══

-- referrals row with referred_user_id=0 (no such user) — set to expired
UPDATE `referrals` SET `status` = 'expired'
  WHERE `referred_user_id` NOT IN (SELECT `id` FROM `users`) AND `referred_user_id` != 0;

-- For referred_user_id=0, we need to NULL it or point to a real user.
-- Since the column is NOT NULL, we'll set it to the referrer's own user ID (self-referral placeholder)
-- and mark it expired so it doesn't pay out.
UPDATE `referrals` r SET r.`referred_user_id` = r.`referrer_id`, r.`status` = 'expired'
  WHERE r.`referred_user_id` = 0;

-- ═══ repair_jobs → system_error_logs ═══

ALTER TABLE `repair_jobs`
  ADD CONSTRAINT `fk_rj_error_log` FOREIGN KEY (`errorLogId`) REFERENCES `system_error_logs`(`id`);

-- ═══ automation_logs → tenants, automations, leads ═══

ALTER TABLE `automation_logs`
  ADD CONSTRAINT `fk_al_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  ADD CONSTRAINT `fk_al_automation` FOREIGN KEY (`automationId`) REFERENCES `automations`(`id`),
  ADD CONSTRAINT `fk_al_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`);

-- ═══ calendar_events → tenants, calendar_connections ═══

ALTER TABLE `calendar_events`
  ADD CONSTRAINT `fk_ce_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  ADD CONSTRAINT `fk_ce_connection` FOREIGN KEY (`calendarConnectionId`) REFERENCES `calendar_connections`(`id`);

-- ═══ calendar_sync_log → calendar_connections ═══

ALTER TABLE `calendar_sync_log`
  ADD CONSTRAINT `fk_csl_connection` FOREIGN KEY (`calendarConnectionId`) REFERENCES `calendar_connections`(`id`);

-- ═══ referrals → users (referrer, referred) ═══

ALTER TABLE `referrals`
  ADD CONSTRAINT `fk_ref_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users`(`id`),
  ADD CONSTRAINT `fk_ref_referred` FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`);

-- ═══ referral_payouts → users ═══

ALTER TABLE `referral_payouts`
  ADD CONSTRAINT `fk_rp_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`);
