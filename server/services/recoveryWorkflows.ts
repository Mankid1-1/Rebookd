/**
 * RECOVERY WORKFLOWS REGISTRY
 *
 * Single source of truth for all 21 automation workflow definitions.
 * Adding a workflow = adding one object to WORKFLOW_REGISTRY. No new files.
 *
 * Each workflow defines:
 *   - Trigger event + type (what fires it)
 *   - Whether it's a recovery flow (state machine: Detected → Contacted → Recovered → Billed)
 *   - Steps to execute (sms, delay, webhook, state_transition)
 *   - Cooldown + max attempts per lead (prevents over-messaging)
 */

import type {
  AutomationWorkflowType,
  WorkflowDefinition,
} from "../../shared/interfaces";

// ─── The Registry ────────────────────────────────────────────────────────────

export const WORKFLOW_REGISTRY: Record<AutomationWorkflowType, WorkflowDefinition> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Revenue Recovery Flows (State Machine Enabled)
  // ═══════════════════════════════════════════════════════════════════════════

  missed_call_textback: {
    key: "missed_call_textback",
    name: "Missed Call Text-Back",
    description: "I've set this up to instantly text anyone whose call you miss — before they call your competitor.",
    category: "lead_capture",
    triggerEvent: "call.missed",
    triggerType: "missed_call",
    priority: 1,
    isRecoveryFlow: true,
    leakageType: "missed_call",
    steps: [
      { type: "state_transition", targetState: "detected" },
      {
        type: "sms",
        messageKey: "missed_call_textback",
        messageBody: "Hi {{name}}, sorry I missed your call! I'd love to help you get booked in — here's my calendar so you can grab a time that works: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 60,
    maxAttemptsPerLead: 1,
  },

  missed_call_followup: {
    key: "missed_call_followup",
    name: "Missed Call Follow-Up",
    description: "I've set this up to follow up 4 hours after a missed call if they haven't booked yet — a gentle nudge with urgency.",
    category: "lead_capture",
    triggerEvent: "call.missed",
    triggerType: "missed_call",
    priority: 1,
    isRecoveryFlow: true,
    leakageType: "missed_call",
    steps: [
      { type: "state_transition", targetState: "detected" },
      { type: "delay", delaySeconds: 14400 }, // 4 hours
      {
        type: "sms",
        messageKey: "missed_call_followup",
        messageBody: "Hi {{name}}, I wanted to make sure you saw my earlier text! I have a few spots opening up soon and I'd hate for you to miss out. Book here: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 480, // 8 hours
    maxAttemptsPerLead: 1,
  },

  missed_call_final_offer: {
    key: "missed_call_final_offer",
    name: "Missed Call Final Offer",
    description: "I've set this up as a final booking nudge 24 hours after a missed call — one last chance before the lead goes cold.",
    category: "lead_capture",
    triggerEvent: "call.missed",
    triggerType: "missed_call",
    priority: 1,
    isRecoveryFlow: true,
    leakageType: "missed_call",
    steps: [
      { type: "state_transition", targetState: "detected" },
      { type: "delay", delaySeconds: 86400 }, // 24 hours
      {
        type: "sms",
        messageKey: "missed_call_final_offer",
        messageBody: "Hi {{name}}, I still have your info from when you called yesterday. I'd really love to help — my calendar is wide open this week: {{bookingLink}}\nNo pressure at all, just didn't want you to slip through the cracks!\nReply STOP to unsubscribe",
        tone: "empathetic",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 1440, // 24 hours
    maxAttemptsPerLead: 1,
  },

  noshow_recovery: {
    key: "noshow_recovery",
    name: "No-Show Recovery",
    description: "I've set this up to automatically reach out 15 minutes after a missed appointment with a rebooking offer.",
    category: "no_show",
    triggerEvent: "appointment.no_show",
    triggerType: "appointment_reminder",
    priority: 2,
    isRecoveryFlow: true,
    leakageType: "no_show",
    steps: [
      { type: "state_transition", targetState: "detected" },
      { type: "delay", delaySeconds: 900 }, // 15 minutes after no-show
      {
        type: "sms",
        messageKey: "reduce_no_shows",
        messageBody: "Hi {{name}}, we missed you today! Life happens — I've held your spot so you can easily rebook: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "empathetic",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 1440, // 24 hours
    maxAttemptsPerLead: 2,
  },

  win_back_90d: {
    key: "win_back_90d",
    name: "90-Day Win-Back",
    description: "I've set this up to reach out to clients who haven't visited in 3 months — before they forget about you.",
    category: "reactivation",
    triggerEvent: "lead.win_back_due",
    triggerType: "win_back",
    priority: 3,
    isRecoveryFlow: true,
    leakageType: "lapsed_client",
    steps: [
      { type: "state_transition", targetState: "detected" },
      {
        type: "sms",
        messageKey: "win_back_campaign",
        messageBody: "Hi {{name}}, it's been a while! We'd love to see you again at {{business}}. Book your next visit: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 43200, // 30 days
    maxAttemptsPerLead: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CANCELLATION RECOVERY (State Machine Enabled)
  // ═══════════════════════════════════════════════════════════════════════════

  cancellation_same_day: {
    key: "cancellation_same_day",
    name: "Same-Day Cancellation Rescue",
    description: "I've set this up to instantly offer a reschedule when someone cancels same-day.",
    category: "cancellation",
    triggerEvent: "appointment.cancelled",
    triggerType: "appointment_reminder",
    priority: 4,
    isRecoveryFlow: true,
    leakageType: "cancellation",
    steps: [
      { type: "state_transition", targetState: "detected" },
      {
        type: "sms",
        messageKey: "cancellation_same_day",
        messageBody: "Hi {{name}}, sorry to hear you can't make it today! Want to grab another time this week? {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "empathetic",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 1440,
    maxAttemptsPerLead: 1,
  },

  cancellation_rescue_48h: {
    key: "cancellation_rescue_48h",
    name: "48-Hour Cancellation Follow-Up",
    description: "I've set this up to follow up 48 hours after a cancellation if they haven't rebooked.",
    category: "cancellation",
    triggerEvent: "appointment.cancelled",
    triggerType: "appointment_reminder",
    priority: 5,
    isRecoveryFlow: true,
    leakageType: "cancellation",
    steps: [
      { type: "state_transition", targetState: "detected" },
      { type: "delay", delaySeconds: 172800 }, // 48 hours
      {
        type: "sms",
        messageKey: "cancellation_followup",
        messageBody: "Hi {{name}}, just checking in — would you like to rebook your appointment at {{business}}? We have great availability: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 4320, // 3 days
    maxAttemptsPerLead: 1,
  },

  cancellation_rescue_7d: {
    key: "cancellation_rescue_7d",
    name: "7-Day Cancellation Win-Back",
    description: "I've set this up to make one last attempt 7 days after cancellation.",
    category: "cancellation",
    triggerEvent: "appointment.cancelled",
    triggerType: "appointment_reminder",
    priority: 6,
    isRecoveryFlow: true,
    leakageType: "cancellation",
    steps: [
      { type: "state_transition", targetState: "detected" },
      { type: "delay", delaySeconds: 604800 }, // 7 days
      {
        type: "sms",
        messageKey: "cancellation_7day",
        messageBody: "Hi {{name}}, we still have your favourite time available at {{business}}! Book before it's gone: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "urgent",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 10080, // 7 days
    maxAttemptsPerLead: 1,
  },

  cancellation_flurry: {
    key: "cancellation_flurry",
    name: "Cancellation Flurry (Waiting List Blast)",
    description: "I've set this up to instantly notify your waiting list when a slot opens up from a cancellation.",
    category: "waiting_list",
    triggerEvent: "waitlist.slot_opened",
    triggerType: "cancellation_flurry",
    priority: 4,
    isRecoveryFlow: true,
    leakageType: "cancellation_flurry",
    steps: [
      { type: "state_transition", targetState: "detected" },
      {
        type: "sms",
        messageKey: "waitlist_notification",
        messageBody: "Great news {{name}}! A spot just opened up at {{business}} on {{date}} at {{time}}. Book it now before it's gone: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "urgent",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 60,
    maxAttemptsPerLead: 3,
  },

  vip_winback_45d: {
    key: "vip_winback_45d",
    name: "VIP 45-Day Win-Back",
    description: "I've set this up to reach out to your VIP clients who haven't been back in 45 days.",
    category: "reactivation",
    triggerEvent: "lead.win_back_due",
    triggerType: "win_back",
    priority: 7,
    isRecoveryFlow: true,
    leakageType: "lapsed_vip",
    steps: [
      { type: "state_transition", targetState: "detected" },
      {
        type: "sms",
        messageKey: "vip_winback",
        messageBody: "Hi {{name}}, we miss seeing you at {{business}}! As one of our valued clients, I'd love to get you back in. Book here: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
      { type: "state_transition", targetState: "contacted" },
    ],
    cooldownMinutes: 21600, // 15 days
    maxAttemptsPerLead: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // APPOINTMENT MANAGEMENT (Not Recovery Flows)
  // ═══════════════════════════════════════════════════════════════════════════

  welcome_new_lead: {
    key: "welcome_new_lead",
    name: "New Lead Welcome",
    description: "I've set this up to instantly welcome new leads with a booking link.",
    category: "welcome",
    triggerEvent: "lead.created",
    triggerType: "new_lead",
    priority: 8,
    isRecoveryFlow: false,
    steps: [
      {
        type: "sms",
        messageKey: "welcome",
        messageBody: "Hi {{name}}, welcome to {{business}}! I'm excited to help you. Book your first appointment here: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
    ],
    cooldownMinutes: 0, // One-time only
    maxAttemptsPerLead: 1,
  },

  appointment_confirmation: {
    key: "appointment_confirmation",
    name: "Booking Confirmation",
    description: "I've set this up to send an instant confirmation when someone books.",
    category: "appointment",
    triggerEvent: "appointment.booked",
    triggerType: "appointment_reminder",
    priority: 9,
    isRecoveryFlow: false,
    steps: [
      {
        type: "sms",
        messageKey: "confirmation",
        messageBody: "Confirmed! Your appointment at {{business}} is set for {{date}} at {{time}}. See you then! Reply YES to confirm or call to reschedule.\nReply STOP to unsubscribe",
        tone: "professional",
      },
    ],
    cooldownMinutes: 0,
    maxAttemptsPerLead: 1,
  },

  appointment_reminder_24h: {
    key: "appointment_reminder_24h",
    name: "24-Hour Appointment Reminder",
    description: "I've set this up to remind clients 24 hours before their appointment.",
    category: "appointment",
    triggerEvent: "appointment.booked",
    triggerType: "time_delay",
    priority: 10,
    isRecoveryFlow: false,
    steps: [
      { type: "delay", delaySeconds: -86400 }, // Negative = before appointment time
      {
        type: "sms",
        messageKey: "reminder",
        messageBody: "Hi {{name}}, reminder: your appointment at {{business}} is tomorrow at {{time}}. Reply YES to confirm.\nReply STOP to unsubscribe",
        tone: "professional",
      },
    ],
    cooldownMinutes: 0,
    maxAttemptsPerLead: 1,
  },

  appointment_reminder_2h: {
    key: "appointment_reminder_2h",
    name: "2-Hour Appointment Reminder",
    description: "I've set this up to send a final reminder 2 hours before the appointment.",
    category: "appointment",
    triggerEvent: "appointment.booked",
    triggerType: "time_delay",
    priority: 11,
    isRecoveryFlow: false,
    steps: [
      { type: "delay", delaySeconds: -7200 }, // 2 hours before
      {
        type: "sms",
        messageKey: "reminder",
        messageBody: "Hi {{name}}, just a heads up — your appointment at {{business}} is in 2 hours at {{time}}. See you soon!\nReply STOP to unsubscribe",
        tone: "casual",
      },
    ],
    cooldownMinutes: 0,
    maxAttemptsPerLead: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEAD NURTURE (Not Recovery Flows)
  // ═══════════════════════════════════════════════════════════════════════════

  inbound_auto_reply: {
    key: "inbound_auto_reply",
    name: "Inbound Auto-Reply",
    description: "I've set this up to instantly reply when someone texts you.",
    category: "lead_capture",
    triggerEvent: "message.received",
    triggerType: "inbound_message",
    priority: 12,
    isRecoveryFlow: false,
    steps: [
      {
        type: "sms",
        messageKey: "auto_reply",
        messageBody: "Thanks for reaching out to {{business}}! I'll get back to you shortly. In the meantime, book an appointment here: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
    ],
    cooldownMinutes: 1440, // Only one auto-reply per day per lead
    maxAttemptsPerLead: 1,
  },

  qualified_followup_1d: {
    key: "qualified_followup_1d",
    name: "1-Day Lead Follow-Up",
    description: "I've set this up to follow up with new leads 24 hours later if they haven't booked.",
    category: "follow_up",
    triggerEvent: "lead.created",
    triggerType: "new_lead",
    priority: 13,
    isRecoveryFlow: false,
    steps: [
      { type: "delay", delaySeconds: 86400 }, // 24 hours
      {
        type: "sms",
        messageKey: "followup_1day",
        messageBody: "Hi {{name}}, just following up from {{business}}! Did you get a chance to check out our availability? Book here: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
    ],
    cooldownMinutes: 2880, // 2 days
    maxAttemptsPerLead: 1,
  },

  qualified_followup_3d: {
    key: "qualified_followup_3d",
    name: "3-Day Lead Follow-Up",
    description: "I've set this up to make a final attempt 3 days after lead creation.",
    category: "follow_up",
    triggerEvent: "lead.created",
    triggerType: "new_lead",
    priority: 14,
    isRecoveryFlow: false,
    steps: [
      { type: "delay", delaySeconds: 259200 }, // 3 days
      {
        type: "sms",
        messageKey: "followup_3day",
        messageBody: "Hi {{name}}, last chance to grab a great time at {{business}} this week! Spots are filling up: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "urgent",
      },
    ],
    cooldownMinutes: 4320, // 3 days
    maxAttemptsPerLead: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOYALTY & ENGAGEMENT (Not Recovery Flows)
  // ═══════════════════════════════════════════════════════════════════════════

  birthday_promo: {
    key: "birthday_promo",
    name: "Birthday Promo",
    description: "I've set this up to send a birthday message with a special offer.",
    category: "loyalty",
    triggerEvent: "lead.birthday",
    triggerType: "birthday",
    priority: 15,
    isRecoveryFlow: false,
    steps: [
      {
        type: "sms",
        messageKey: "birthday_promo",
        messageBody: "Happy Birthday {{name}}! {{business}} wants to celebrate with you — enjoy a special treat on your next visit! Book here: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
    ],
    cooldownMinutes: 525600, // 365 days (once a year)
    maxAttemptsPerLead: 1,
  },

  loyalty_milestone: {
    key: "loyalty_milestone",
    name: "Loyalty Milestone",
    description: "I've set this up to celebrate when a client hits a visit milestone.",
    category: "loyalty",
    triggerEvent: "lead.loyalty_milestone",
    triggerType: "loyalty_milestone",
    priority: 16,
    isRecoveryFlow: false,
    steps: [
      {
        type: "sms",
        messageKey: "loyalty_milestone",
        messageBody: "Wow {{name}}, you've been with {{business}} for {{milestone}} visits! Thank you for your loyalty — we have something special for you on your next visit!\nReply STOP to unsubscribe",
        tone: "friendly",
      },
    ],
    cooldownMinutes: 43200, // 30 days
    maxAttemptsPerLead: 10,
  },

  review_request: {
    key: "review_request",
    name: "Review Request",
    description: "I've set this up to ask for a review after a successful appointment.",
    category: "review",
    triggerEvent: "review.requested",
    triggerType: "review_request",
    priority: 17,
    isRecoveryFlow: false,
    steps: [
      { type: "delay", delaySeconds: 3600 }, // 1 hour after appointment
      {
        type: "sms",
        messageKey: "review_request",
        messageBody: "Hi {{name}}, thanks for visiting {{business}} today! If you enjoyed your experience, I'd really appreciate a quick review: {{reviewLink}}\nReply STOP to unsubscribe",
        tone: "friendly",
      },
    ],
    cooldownMinutes: 10080, // 7 days
    maxAttemptsPerLead: 1,
  },

  rescheduling_offer: {
    key: "rescheduling_offer",
    name: "Rescheduling Offer",
    description: "I've set this up to suggest alternative times when someone reschedules.",
    category: "rescheduling",
    triggerEvent: "appointment.rescheduled",
    triggerType: "rescheduling",
    priority: 18,
    isRecoveryFlow: false,
    steps: [
      {
        type: "sms",
        messageKey: "rescheduling_offer",
        messageBody: "Hi {{name}}, your appointment has been rescheduled. Here are some great alternative times at {{business}}: {{bookingLink}}\nReply STOP to unsubscribe",
        tone: "professional",
      },
    ],
    cooldownMinutes: 60,
    maxAttemptsPerLead: 3,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get a workflow by its key */
export function getWorkflow(key: string): WorkflowDefinition | undefined {
  return WORKFLOW_REGISTRY[key as AutomationWorkflowType];
}

/** Check if a key is a registered workflow */
export function isRegisteredWorkflow(key: string): key is AutomationWorkflowType {
  return key in WORKFLOW_REGISTRY;
}

/** Get all recovery workflows (state machine enabled) */
export function getRecoveryWorkflows(): WorkflowDefinition[] {
  return Object.values(WORKFLOW_REGISTRY).filter((w) => w.isRecoveryFlow);
}

/** Get workflows by trigger event type */
export function getWorkflowsByTrigger(eventType: string): WorkflowDefinition[] {
  return Object.values(WORKFLOW_REGISTRY)
    .filter((w) => w.triggerEvent === eventType)
    .sort((a, b) => a.priority - b.priority);
}

/** Get all workflow keys as an array */
export function getAllWorkflowKeys(): AutomationWorkflowType[] {
  return Object.keys(WORKFLOW_REGISTRY) as AutomationWorkflowType[];
}
