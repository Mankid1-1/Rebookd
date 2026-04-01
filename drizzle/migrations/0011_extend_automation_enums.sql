-- ============================================================================
-- Migration 0011: Extend Automation Trigger Types and Categories
--
-- Purpose:
--   Add new trigger types and categories needed for the 19-workflow engine.
--   MySQL MODIFY COLUMN preserves existing data when all current enum values
--   are retained in the new definition.
-- ============================================================================

-- ─── Extend triggerType enum ─────────────────────────────────────────────────

ALTER TABLE `automations`
  MODIFY COLUMN `triggerType` enum(
    'new_lead',
    'inbound_message',
    'status_change',
    'time_delay',
    'appointment_reminder',
    'missed_call',
    'cancellation_flurry',
    'win_back',
    'birthday',
    'loyalty_milestone',
    'review_request',
    'waitlist_slot_opened',
    'rescheduling'
  ) NOT NULL DEFAULT 'new_lead';

-- ─── Extend category enum ───────────────────────────────────────────────────

ALTER TABLE `automations`
  MODIFY COLUMN `category` enum(
    'follow_up',
    'reactivation',
    'appointment',
    'welcome',
    'custom',
    'no_show',
    'cancellation',
    'loyalty',
    'review',
    'rescheduling',
    'waiting_list',
    'lead_capture'
  ) NOT NULL DEFAULT 'custom';
