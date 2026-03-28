/**
 * In-house message template pool for Rebooked AI.
 * Zero external API tokens — all messages generated from these templates.
 * Organized by message type × tone, with multiple variations for freshness.
 */

export type Tone = "friendly" | "professional" | "casual" | "urgent" | "empathetic";

export type MessageType =
  | "confirmation"
  | "cancellation"
  | "rebooking"
  | "reminder"
  | "no_show"
  | "follow_up"
  | "after_hours"
  | "lead_capture"
  | "retention_rebooking"
  | "loyalty_reward"
  | "reactivation"
  | "card_on_file"
  | "deposit_request"
  | "cancellation_fee"
  | "no_show_penalty"
  | "payment_reminder"
  | "gap_fill"
  | "off_peak_offer"
  | "reschedule"
  | "generic";

export interface TemplateEntry {
  type: MessageType;
  tone: Tone;
  templates: string[];
}

export const MESSAGE_TEMPLATES: TemplateEntry[] = [
  // ═══════════════════════════════════════════
  // CONFIRMATION
  // ═══════════════════════════════════════════
  {
    type: "confirmation",
    tone: "friendly",
    templates: [
      "Hi {{name}}! Your appt on {{date}} at {{time}} is confirmed. Can't wait to see you! Reply YES to confirm.",
      "Hey {{name}}! You're all set for {{date}} at {{time}}. See you then! Reply CONFIRM or CHANGE to reschedule.",
      "{{name}}, you're booked for {{date}} at {{time}}! We're looking forward to it. Reply YES to confirm.",
      "Great news {{name}}! Your appointment is locked in for {{date}} at {{time}}. Reply YES to confirm!",
    ],
  },
  {
    type: "confirmation",
    tone: "professional",
    templates: [
      "{{name}}, your appointment is confirmed for {{date}} at {{time}}. Please reply CONFIRM or RESCHEDULE. - {{business}}",
      "Appointment confirmed: {{date}} at {{time}}. Please reply YES to confirm your attendance. - {{business}}",
      "This is a confirmation for your {{date}} appointment at {{time}}. Reply CONFIRM to verify. - {{business}}",
    ],
  },
  {
    type: "confirmation",
    tone: "casual",
    templates: [
      "Hey {{name}}! Just confirming {{date}} at {{time}} — you good? Reply YES or let us know!",
      "{{name}} — quick check: still on for {{date}} at {{time}}? Reply YES or CHANGE!",
      "Hey! Your spot on {{date}} at {{time}} is saved. See you there? Reply YES!",
    ],
  },
  {
    type: "confirmation",
    tone: "urgent",
    templates: [
      "{{name}}, please confirm your {{date}} appointment at {{time}} ASAP. Reply YES now to hold your spot.",
      "REMINDER: {{name}}, your appt is {{date}} at {{time}}. Confirm NOW by replying YES or we may need to release your spot.",
      "{{name}} — your appointment is {{date}} at {{time}}. Please reply YES immediately to confirm.",
    ],
  },
  {
    type: "confirmation",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, just a gentle reminder about your appointment on {{date}} at {{time}}. Reply YES when you're ready to confirm!",
      "{{name}}, we have you down for {{date}} at {{time}}. No rush — reply YES to confirm or let us know if you need to adjust.",
      "Hi {{name}}, checking in about your {{date}} appointment at {{time}}. Let us know if everything still works for you!",
    ],
  },

  // ═══════════════════════════════════════════
  // CANCELLATION
  // ═══════════════════════════════════════════
  {
    type: "cancellation",
    tone: "friendly",
    templates: [
      "Hi {{name}}, we're sorry to see your appointment cancelled. We'd love to reschedule — reply BOOK to pick a new time!",
      "{{name}}, your appointment has been cancelled. We'll miss you! Reply REBOOK to find a new time that works.",
      "Hey {{name}}, we got your cancellation. No worries! When you're ready to rebook, reply BOOK. {{business}}",
    ],
  },
  {
    type: "cancellation",
    tone: "professional",
    templates: [
      "{{name}}, your appointment has been cancelled. To reschedule, please reply REBOOK or contact us. - {{business}}",
      "Your appointment has been cancelled, {{name}}. Reply REBOOK at your convenience to schedule a new time. - {{business}}",
      "Cancellation confirmed for {{name}}. We look forward to serving you again. Reply REBOOK to reschedule. - {{business}}",
    ],
  },
  {
    type: "cancellation",
    tone: "casual",
    templates: [
      "Hey {{name}}, no problem — your appt is cancelled. Just text BOOK whenever you want to reschedule!",
      "{{name}}, all cancelled! Whenever you're ready, text us BOOK to grab a new spot.",
      "Got it {{name}}, you're all set. Hit us up with BOOK when you want to come back!",
    ],
  },
  {
    type: "cancellation",
    tone: "urgent",
    templates: [
      "{{name}}, your appointment was cancelled. Spots fill fast — reply REBOOK now to secure a new time!",
      "{{name}} — cancellation confirmed. Don't miss out, reply REBOOK now for the next available slot!",
    ],
  },
  {
    type: "cancellation",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we understand things come up. Your appointment is cancelled. Whenever you're ready, reply BOOK and we'll find a time.",
      "{{name}}, no worries at all about cancelling. Life happens! Reply BOOK when you'd like to reschedule. We're here for you.",
      "We totally understand, {{name}}. Your cancellation is confirmed. Take your time and text BOOK when you're ready.",
    ],
  },

  // ═══════════════════════════════════════════
  // REBOOKING
  // ═══════════════════════════════════════════
  {
    type: "rebooking",
    tone: "friendly",
    templates: [
      "Hi {{name}}! We have openings this week. Ready to rebook? Reply BOOK to grab your spot! - {{business}}",
      "{{name}}, we'd love to see you again! Openings available soon. Reply BOOK to schedule. - {{business}}",
      "Hey {{name}}! It's been a while. We have spots open — reply BOOK to get back on the schedule!",
    ],
  },
  {
    type: "rebooking",
    tone: "professional",
    templates: [
      "{{name}}, appointment slots are available. Reply BOOK to schedule your next visit. - {{business}}",
      "We have availability for you, {{name}}. Reply BOOK to reserve your preferred time. - {{business}}",
    ],
  },
  {
    type: "rebooking",
    tone: "casual",
    templates: [
      "Hey {{name}}! Spots are open — want to come in? Text BOOK to grab one!",
      "{{name}}, we've got openings! Text BOOK to snag a time that works for you.",
    ],
  },
  {
    type: "rebooking",
    tone: "urgent",
    templates: [
      "{{name}}, limited spots available this week! Reply BOOK now before they fill up. - {{business}}",
      "Act fast {{name}}! We just had a cancellation — reply BOOK to grab this slot before it's gone!",
      "{{name}} — a prime time slot just opened up. Reply BOOK now to claim it!",
    ],
  },
  {
    type: "rebooking",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, whenever you're ready, we're here. We have flexible openings — reply BOOK at your convenience.",
      "{{name}}, we know scheduling can be tricky. We have openings that might work for you — reply BOOK when ready.",
    ],
  },

  // ═══════════════════════════════════════════
  // REMINDER
  // ═══════════════════════════════════════════
  {
    type: "reminder",
    tone: "friendly",
    templates: [
      "Hi {{name}}! Just a friendly reminder about your appointment tomorrow, {{date}} at {{time}}. See you soon!",
      "{{name}}, don't forget — you have an appointment on {{date}} at {{time}}! We're excited to see you!",
      "Reminder: {{name}}, your visit is coming up on {{date}} at {{time}}. Can't wait! - {{business}}",
    ],
  },
  {
    type: "reminder",
    tone: "professional",
    templates: [
      "Reminder: {{name}}, your appointment is scheduled for {{date}} at {{time}}. - {{business}}",
      "{{name}}, this is a reminder for your upcoming appointment on {{date}} at {{time}}. - {{business}}",
      "Appointment reminder for {{name}}: {{date}} at {{time}}. Please arrive on time. - {{business}}",
    ],
  },
  {
    type: "reminder",
    tone: "casual",
    templates: [
      "Hey {{name}}! Heads up — your appt is {{date}} at {{time}}. See you there!",
      "{{name}}, quick reminder: {{date}} at {{time}}. Don't be late! 😉",
      "Yo {{name}}! Tomorrow at {{time}} — don't forget! See ya!",
    ],
  },
  {
    type: "reminder",
    tone: "urgent",
    templates: [
      "{{name}}, your appointment is in less than 24 hours — {{date}} at {{time}}. Please confirm NOW by replying YES.",
      "IMPORTANT: {{name}}, your appointment is {{date}} at {{time}}. Reply YES to confirm or CHANGE to reschedule immediately.",
    ],
  },
  {
    type: "reminder",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, a gentle reminder about your upcoming appointment on {{date}} at {{time}}. Let us know if anything's changed!",
      "{{name}}, just checking in — you're scheduled for {{date}} at {{time}}. If you need to adjust, we're happy to help!",
    ],
  },

  // ═══════════════════════════════════════════
  // NO-SHOW
  // ═══════════════════════════════════════════
  {
    type: "no_show",
    tone: "friendly",
    templates: [
      "Hi {{name}}, we missed you today! No worries — reply REBOOK to reschedule when you're ready. - {{business}}",
      "{{name}}, we noticed you couldn't make it today. We'd love to see you! Reply REBOOK to find a new time.",
      "Hey {{name}}! We missed seeing you. Things happen — reply BOOK to get back on the schedule!",
    ],
  },
  {
    type: "no_show",
    tone: "professional",
    templates: [
      "{{name}}, we noticed you were unable to attend your appointment today. Please reply REBOOK to reschedule. - {{business}}",
      "{{name}}, your scheduled appointment was missed. To reschedule, reply REBOOK at your convenience. - {{business}}",
    ],
  },
  {
    type: "no_show",
    tone: "casual",
    templates: [
      "Hey {{name}}! Looks like you missed your appt today. No biggie — text BOOK when you want to come in!",
      "{{name}}, we missed you today! Text BOOK to reschedule whenever.",
    ],
  },
  {
    type: "no_show",
    tone: "urgent",
    templates: [
      "{{name}}, you missed your appointment today. Limited rebooking slots available — reply REBOOK now to secure one!",
      "{{name}} — missed appointment today. Reply REBOOK immediately to grab one of our remaining open slots.",
    ],
  },
  {
    type: "no_show",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we understand things come up. You missed your appointment today, but we're here when you're ready. Reply BOOK.",
      "{{name}}, no judgment at all — life gets busy. Whenever you're ready to reschedule, just reply BOOK. We're here!",
    ],
  },

  // ═══════════════════════════════════════════
  // FOLLOW-UP
  // ═══════════════════════════════════════════
  {
    type: "follow_up",
    tone: "friendly",
    templates: [
      "Hi {{name}}! Just checking in from {{business}}. How was everything? Ready to book your next visit? Reply BOOK!",
      "Hey {{name}}! Hope you loved your visit. Ready for round two? Reply BOOK to schedule! - {{business}}",
      "{{name}}, thanks for visiting {{business}}! We'd love to see you again. Reply BOOK for your next appointment.",
    ],
  },
  {
    type: "follow_up",
    tone: "professional",
    templates: [
      "{{name}}, thank you for your recent visit to {{business}}. To schedule your next appointment, reply BOOK.",
      "Following up from {{business}}, {{name}}. We hope you were satisfied. Reply BOOK for your next visit.",
    ],
  },
  {
    type: "follow_up",
    tone: "casual",
    templates: [
      "Hey {{name}}! How'd everything go? Want to book again? Just text BOOK!",
      "{{name}}, hope you had a great time! Text BOOK to come back soon.",
    ],
  },
  {
    type: "follow_up",
    tone: "urgent",
    templates: [
      "{{name}}, popular time slots are filling up! Reply BOOK now to secure your next visit at {{business}}.",
      "Don't wait too long, {{name}}! Spots fill fast. Reply BOOK to schedule your next visit today.",
    ],
  },
  {
    type: "follow_up",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we hope everything went well at your last visit. We'd love to see you again — reply BOOK when ready!",
      "{{name}}, we appreciate your visit to {{business}}. Whenever you'd like to come back, just reply BOOK. No rush!",
    ],
  },

  // ═══════════════════════════════════════════
  // AFTER-HOURS
  // ═══════════════════════════════════════════
  {
    type: "after_hours",
    tone: "friendly",
    templates: [
      "Hi {{name}}! Thanks for reaching out to {{business}}. We're closed right now but will get back to you first thing! Book anytime: {{link}}",
      "Hey {{name}}! We're currently closed but got your message. Book online anytime: {{link}} - {{business}}",
      "{{name}}, thanks for contacting us! We're closed now but you can book 24/7 here: {{link}} - {{business}}",
    ],
  },
  {
    type: "after_hours",
    tone: "professional",
    templates: [
      "Thank you for contacting {{business}}, {{name}}. We are currently closed. You may book online at: {{link}}",
      "{{name}}, {{business}} is currently closed. We'll respond during business hours. Book online: {{link}}",
    ],
  },
  {
    type: "after_hours",
    tone: "casual",
    templates: [
      "Hey {{name}}! We're off the clock but you can book anytime here: {{link}} — talk soon!",
      "{{name}}, we're closed rn but you can grab a spot online: {{link}} - {{business}}",
    ],
  },
  {
    type: "after_hours",
    tone: "urgent",
    templates: [
      "{{name}}, we're closed now but spots fill quickly. Book online now to secure your time: {{link}} - {{business}}",
    ],
  },
  {
    type: "after_hours",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, thanks for reaching out. We're closed for the evening but we'll follow up soon. Book anytime: {{link}}",
      "{{name}}, we appreciate your message! We're closed now but you can book at your convenience: {{link}} - {{business}}",
    ],
  },

  // ═══════════════════════════════════════════
  // LEAD CAPTURE
  // ═══════════════════════════════════════════
  {
    type: "lead_capture",
    tone: "friendly",
    templates: [
      "Hi {{name}}! Thanks for your interest in {{business}}! We'd love to help you. Book your first visit here: {{link}}",
      "Hey {{name}}! Welcome to {{business}}! Ready to get started? Book now: {{link}}",
      "{{name}}, so glad you reached out to {{business}}! Book your appointment here: {{link}} — we can't wait!",
    ],
  },
  {
    type: "lead_capture",
    tone: "professional",
    templates: [
      "{{name}}, thank you for your inquiry. Schedule your appointment with {{business}} here: {{link}}",
      "Welcome, {{name}}. To book your visit with {{business}}, please use this link: {{link}}",
    ],
  },
  {
    type: "lead_capture",
    tone: "casual",
    templates: [
      "Hey {{name}}! Awesome that you found us. Book your spot here: {{link}} - {{business}}",
      "{{name}}, welcome! Grab a time that works for you: {{link}} — see you soon!",
    ],
  },
  {
    type: "lead_capture",
    tone: "urgent",
    templates: [
      "{{name}}, thanks for reaching out! Spots are limited — book now: {{link}} - {{business}}",
      "{{name}} — we got your info! Don't miss out, book today: {{link}} - {{business}}",
    ],
  },
  {
    type: "lead_capture",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, thanks for reaching out to {{business}}. We're here to help! Book when you're ready: {{link}}",
      "{{name}}, welcome! Take your time looking around. When you're ready, book here: {{link}} - {{business}}",
    ],
  },

  // ═══════════════════════════════════════════
  // RETENTION - REBOOKING
  // ═══════════════════════════════════════════
  {
    type: "retention_rebooking",
    tone: "friendly",
    templates: [
      "Hi {{name}}! It's been a while since your last visit. We miss you! Reply BOOK to come back. - {{business}}",
      "{{name}}, we haven't seen you in a bit! Ready for your next visit? Reply BOOK! - {{business}}",
      "Hey {{name}}! Time for a refresh? We have openings — reply BOOK to schedule. - {{business}}",
    ],
  },
  {
    type: "retention_rebooking",
    tone: "professional",
    templates: [
      "{{name}}, it has been some time since your last appointment. We'd be pleased to schedule your next visit. Reply BOOK.",
      "{{name}}, we value your patronage. Please reply BOOK to schedule your next appointment. - {{business}}",
    ],
  },
  {
    type: "retention_rebooking",
    tone: "casual",
    templates: [
      "Hey {{name}}! Long time no see. Come back and visit us — text BOOK!",
      "{{name}}, we miss your face! Text BOOK to swing by again. - {{business}}",
    ],
  },
  {
    type: "retention_rebooking",
    tone: "urgent",
    templates: [
      "{{name}}, don't let too much time pass! Book your next visit now before slots fill up. Reply BOOK. - {{business}}",
      "{{name}} — it's been too long! Limited availability this week. Reply BOOK now!",
    ],
  },
  {
    type: "retention_rebooking",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, it's been a little while. We hope all is well! Whenever you're ready, reply BOOK. - {{business}}",
      "{{name}}, we miss seeing you but understand life gets busy. Reply BOOK when you'd like to come back!",
    ],
  },

  // ═══════════════════════════════════════════
  // LOYALTY REWARD
  // ═══════════════════════════════════════════
  {
    type: "loyalty_reward",
    tone: "friendly",
    templates: [
      "{{name}}, you're one of our favorite clients! As a thank you, enjoy a special offer on your next visit. Reply BOOK!",
      "Hi {{name}}! Your loyalty means the world to us. We have a treat for you — reply BOOK to claim it!",
      "{{name}}, thanks for being a loyal client! Your next visit comes with a special perk. Reply BOOK! - {{business}}",
    ],
  },
  {
    type: "loyalty_reward",
    tone: "professional",
    templates: [
      "{{name}}, as a valued client of {{business}}, you've earned a loyalty reward. Reply BOOK to redeem.",
      "Thank you for your continued patronage, {{name}}. A special offer awaits your next visit. Reply BOOK.",
    ],
  },
  {
    type: "loyalty_reward",
    tone: "casual",
    templates: [
      "Hey {{name}}! VIP alert — we've got something special for you. Text BOOK to claim it!",
      "{{name}}, loyalty perks unlocked! Text BOOK to get your reward. - {{business}}",
    ],
  },
  {
    type: "loyalty_reward",
    tone: "urgent",
    templates: [
      "{{name}}, your loyalty reward expires soon! Reply BOOK now to claim your special offer. - {{business}}",
      "Don't let your reward expire, {{name}}! Reply BOOK today to redeem. Limited time!",
    ],
  },
  {
    type: "loyalty_reward",
    tone: "empathetic",
    templates: [
      "{{name}}, we truly appreciate you choosing {{business}}. We'd love to give back — reply BOOK for a special treat!",
      "Hi {{name}}, your loyalty hasn't gone unnoticed. We have a little something for you — reply BOOK when you're ready!",
    ],
  },

  // ═══════════════════════════════════════════
  // REACTIVATION
  // ═══════════════════════════════════════════
  {
    type: "reactivation",
    tone: "friendly",
    templates: [
      "Hi {{name}}! It's been too long since we've seen you at {{business}}. We'd love to welcome you back! Reply BOOK.",
      "{{name}}, we miss you at {{business}}! Come back and see what's new. Reply BOOK to schedule.",
      "Hey {{name}}! We've been thinking about you. Ready to come back to {{business}}? Reply BOOK!",
    ],
  },
  {
    type: "reactivation",
    tone: "professional",
    templates: [
      "{{name}}, we'd like to invite you back to {{business}}. Reply BOOK to schedule your return visit.",
      "It's been a while, {{name}}. {{business}} would be pleased to welcome you back. Reply BOOK to schedule.",
    ],
  },
  {
    type: "reactivation",
    tone: "casual",
    templates: [
      "{{name}}! Where have you been? We miss you. Text BOOK to come hang! - {{business}}",
      "Hey {{name}}, stranger! Come see us again — text BOOK. We miss you!",
    ],
  },
  {
    type: "reactivation",
    tone: "urgent",
    templates: [
      "{{name}}, we have a special welcome-back offer just for you. Reply BOOK now — limited time only! - {{business}}",
      "{{name}} — special reactivation offer! Reply BOOK now before it expires. - {{business}}",
    ],
  },
  {
    type: "reactivation",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we know life gets hectic. Whenever you're ready to come back, we're here. Reply BOOK. - {{business}}",
      "{{name}}, it's been a while and we hope you're doing well. No pressure — reply BOOK whenever feels right!",
    ],
  },

  // ═══════════════════════════════════════════
  // CARD ON FILE
  // ═══════════════════════════════════════════
  {
    type: "card_on_file",
    tone: "friendly",
    templates: [
      "Hi {{name}}! To make checkout seamless, please add a card on file. It's quick and secure: {{link}} - {{business}}",
      "{{name}}, add a card on file for faster checkout at {{business}}! Secure link: {{link}}",
      "Hey {{name}}! Save time at your next visit — add your card here: {{link}} - {{business}}",
    ],
  },
  {
    type: "card_on_file",
    tone: "professional",
    templates: [
      "{{name}}, {{business}} requires a card on file for your appointment. Please add one securely here: {{link}}",
      "{{name}}, please provide a card on file to confirm your booking. Secure link: {{link}} - {{business}}",
    ],
  },
  {
    type: "card_on_file",
    tone: "casual",
    templates: [
      "Hey {{name}}! Quick thing — drop a card on file so checkout is a breeze: {{link}}",
      "{{name}}, save yourself time next visit — add your card here: {{link}} - {{business}}",
    ],
  },
  {
    type: "card_on_file",
    tone: "urgent",
    templates: [
      "{{name}}, a card on file is required to keep your appointment. Please add one now: {{link}} - {{business}}",
      "ACTION REQUIRED: {{name}}, add a card on file to confirm your booking: {{link}} - {{business}}",
    ],
  },
  {
    type: "card_on_file",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we know sharing card info can feel like a lot. It's fully secure and helps us serve you better: {{link}}",
      "{{name}}, adding a card on file is optional but makes your experience smoother. Secure link: {{link}} - {{business}}",
    ],
  },

  // ═══════════════════════════════════════════
  // DEPOSIT REQUEST
  // ═══════════════════════════════════════════
  {
    type: "deposit_request",
    tone: "friendly",
    templates: [
      "Hi {{name}}! A small deposit of {{amount}} is needed to confirm your appointment. Pay securely here: {{link}}",
      "{{name}}, your booking requires a {{amount}} deposit. Quick and easy payment here: {{link}} - {{business}}",
    ],
  },
  {
    type: "deposit_request",
    tone: "professional",
    templates: [
      "{{name}}, a deposit of {{amount}} is required to confirm your appointment. Please pay here: {{link}} - {{business}}",
      "To secure your appointment, {{name}}, a {{amount}} deposit is required. Payment link: {{link}} - {{business}}",
    ],
  },
  {
    type: "deposit_request",
    tone: "casual",
    templates: [
      "Hey {{name}}! Quick deposit of {{amount}} needed to lock in your spot: {{link}}",
      "{{name}}, just a {{amount}} deposit to hold your time — pay here: {{link}} - {{business}}",
    ],
  },
  {
    type: "deposit_request",
    tone: "urgent",
    templates: [
      "{{name}}, pay your {{amount}} deposit NOW to keep your spot: {{link}} - Spots are filling fast!",
      "URGENT: {{name}}, your {{amount}} deposit is due to confirm your booking. Pay now: {{link}}",
    ],
  },
  {
    type: "deposit_request",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we require a small {{amount}} deposit to hold your spot. No surprises — pay securely: {{link}}",
      "{{name}}, a {{amount}} deposit helps us save your spot. Quick and secure: {{link}} - {{business}}",
    ],
  },

  // ═══════════════════════════════════════════
  // CANCELLATION FEE
  // ═══════════════════════════════════════════
  {
    type: "cancellation_fee",
    tone: "friendly",
    templates: [
      "Hi {{name}}, a cancellation fee of {{amount}} has been applied per our policy. Questions? Reply to this message. - {{business}}",
      "{{name}}, your late cancellation resulted in a {{amount}} fee. We understand things happen! Contact us with questions.",
    ],
  },
  {
    type: "cancellation_fee",
    tone: "professional",
    templates: [
      "{{name}}, per our cancellation policy, a fee of {{amount}} has been charged. For questions, please contact {{business}}.",
      "A cancellation fee of {{amount}} has been applied to your account, {{name}}, per the agreed policy. - {{business}}",
    ],
  },
  {
    type: "cancellation_fee",
    tone: "casual",
    templates: [
      "Hey {{name}}, heads up — a {{amount}} cancellation fee was applied. Reach out if you have questions!",
    ],
  },
  {
    type: "cancellation_fee",
    tone: "urgent",
    templates: [
      "{{name}}, a {{amount}} cancellation fee has been applied. Please review your account. - {{business}}",
    ],
  },
  {
    type: "cancellation_fee",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we understand cancellations happen. A {{amount}} fee was applied per policy. We're here if you have questions.",
      "{{name}}, a {{amount}} fee was charged for the late cancellation. We know it's not ideal — reach out with any concerns.",
    ],
  },

  // ═══════════════════════════════════════════
  // NO-SHOW PENALTY
  // ═══════════════════════════════════════════
  {
    type: "no_show_penalty",
    tone: "friendly",
    templates: [
      "Hi {{name}}, we missed you today! A no-show fee of {{amount}} was applied. Reply REBOOK to schedule again. - {{business}}",
      "{{name}}, a {{amount}} no-show fee was charged. We'd love to see you — reply REBOOK to try again!",
    ],
  },
  {
    type: "no_show_penalty",
    tone: "professional",
    templates: [
      "{{name}}, a no-show fee of {{amount}} has been applied per our policy. To reschedule, reply REBOOK. - {{business}}",
      "Per our appointment policy, a {{amount}} fee has been charged for your missed appointment, {{name}}. - {{business}}",
    ],
  },
  {
    type: "no_show_penalty",
    tone: "casual",
    templates: [
      "Hey {{name}}, you missed your appt so a {{amount}} fee was charged. No hard feelings — text REBOOK to come in!",
    ],
  },
  {
    type: "no_show_penalty",
    tone: "urgent",
    templates: [
      "{{name}}, a {{amount}} no-show fee was charged. To avoid future fees, reply REBOOK now to reschedule. - {{business}}",
    ],
  },
  {
    type: "no_show_penalty",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we understand you couldn't make it. A {{amount}} fee was applied per our policy. We're here to help you reschedule.",
      "{{name}}, we know things happen. A {{amount}} no-show fee was charged. Whenever you're ready, reply REBOOK. No judgment!",
    ],
  },

  // ═══════════════════════════════════════════
  // PAYMENT REMINDER
  // ═══════════════════════════════════════════
  {
    type: "payment_reminder",
    tone: "friendly",
    templates: [
      "Hi {{name}}! Just a reminder that you have a payment of {{amount}} due. Pay securely here: {{link}} - {{business}}",
      "{{name}}, friendly reminder — {{amount}} is due. Quick payment link: {{link}} - {{business}}",
    ],
  },
  {
    type: "payment_reminder",
    tone: "professional",
    templates: [
      "{{name}}, this is a reminder that {{amount}} is due. Please make your payment here: {{link}} - {{business}}",
      "Payment reminder for {{name}}: {{amount}} due. Secure payment link: {{link}} - {{business}}",
    ],
  },
  {
    type: "payment_reminder",
    tone: "casual",
    templates: [
      "Hey {{name}}! Quick heads up — {{amount}} is due. Pay here: {{link}}",
      "{{name}}, just a nudge — you've got {{amount}} to pay. Easy link: {{link}}",
    ],
  },
  {
    type: "payment_reminder",
    tone: "urgent",
    templates: [
      "{{name}}, payment of {{amount}} is overdue. Please pay immediately: {{link}} - {{business}}",
      "OVERDUE: {{name}}, {{amount}} payment required. Pay now: {{link}} - {{business}}",
    ],
  },
  {
    type: "payment_reminder",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, just a gentle reminder about your {{amount}} balance. Pay when you can: {{link}} - {{business}}",
      "{{name}}, we know budgeting can be tough. A payment of {{amount}} is due — here's an easy link: {{link}}",
    ],
  },

  // ═══════════════════════════════════════════
  // GAP FILL (scheduling)
  // ═══════════════════════════════════════════
  {
    type: "gap_fill",
    tone: "friendly",
    templates: [
      "Hi {{name}}! We just had a cancellation on {{date}} at {{time}}. Want this spot? Reply YES to grab it!",
      "{{name}}, great news — a spot just opened on {{date}} at {{time}}! Reply YES if you want it. - {{business}}",
      "Lucky you, {{name}}! {{date}} at {{time}} just became available. Reply YES to book it!",
    ],
  },
  {
    type: "gap_fill",
    tone: "professional",
    templates: [
      "{{name}}, an appointment slot has become available on {{date}} at {{time}}. Reply YES to reserve. - {{business}}",
      "A scheduling opening on {{date}} at {{time}} is now available, {{name}}. Reply YES to book. - {{business}}",
    ],
  },
  {
    type: "gap_fill",
    tone: "casual",
    templates: [
      "Hey {{name}}! Spot just opened up on {{date}} at {{time}} — want it? Text YES!",
      "{{name}}, {{date}} at {{time}} is up for grabs! Text YES to claim it.",
    ],
  },
  {
    type: "gap_fill",
    tone: "urgent",
    templates: [
      "{{name}} — JUST CANCELLED: {{date}} at {{time}} is available NOW. Reply YES immediately to claim!",
      "{{name}}, last-minute opening on {{date}} at {{time}}! Reply YES now — first come, first served!",
    ],
  },
  {
    type: "gap_fill",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, a spot opened up on {{date}} at {{time}} if that works better for you. Reply YES if interested!",
      "{{name}}, in case you've been waiting — {{date}} at {{time}} just opened up. Reply YES if you'd like it!",
    ],
  },

  // ═══════════════════════════════════════════
  // OFF-PEAK OFFER
  // ═══════════════════════════════════════════
  {
    type: "off_peak_offer",
    tone: "friendly",
    templates: [
      "Hi {{name}}! We have special off-peak availability. Book during quieter times and enjoy a relaxed experience! Reply BOOK.",
      "{{name}}, looking for a chill visit? Our off-peak hours have great availability. Reply BOOK! - {{business}}",
    ],
  },
  {
    type: "off_peak_offer",
    tone: "professional",
    templates: [
      "{{name}}, off-peak appointments are available at {{business}}. Reply BOOK to take advantage of flexible scheduling.",
      "Consider booking during off-peak hours, {{name}}. More availability and shorter wait times. Reply BOOK. - {{business}}",
    ],
  },
  {
    type: "off_peak_offer",
    tone: "casual",
    templates: [
      "Hey {{name}}! Got some open spots during our quieter hours. Text BOOK for a chill experience!",
      "{{name}}, off-peak = no crowds. Text BOOK if that sounds good to you!",
    ],
  },
  {
    type: "off_peak_offer",
    tone: "urgent",
    templates: [
      "{{name}}, limited off-peak slots available at special rates! Reply BOOK now to grab one. - {{business}}",
    ],
  },
  {
    type: "off_peak_offer",
    tone: "empathetic",
    templates: [
      "{{name}}, if peak hours don't work for you, we have flexible off-peak times available. Reply BOOK to find one!",
      "Hi {{name}}, we know busy schedules can be tough. Try an off-peak time for more flexibility. Reply BOOK!",
    ],
  },

  // ═══════════════════════════════════════════
  // RESCHEDULE
  // ═══════════════════════════════════════════
  {
    type: "reschedule",
    tone: "friendly",
    templates: [
      "Hi {{name}}! Need to reschedule? No problem! Reply BOOK to pick a new time. - {{business}}",
      "{{name}}, we're happy to find a better time for you! Reply BOOK to reschedule. - {{business}}",
    ],
  },
  {
    type: "reschedule",
    tone: "professional",
    templates: [
      "{{name}}, to reschedule your appointment, please reply BOOK or visit: {{link}} - {{business}}",
      "Your appointment can be rescheduled, {{name}}. Reply BOOK to select a new date and time. - {{business}}",
    ],
  },
  {
    type: "reschedule",
    tone: "casual",
    templates: [
      "Hey {{name}}! No worries about rescheduling. Text BOOK to grab a new time!",
      "{{name}}, need a different time? Text BOOK and we'll sort it out!",
    ],
  },
  {
    type: "reschedule",
    tone: "urgent",
    templates: [
      "{{name}}, please reschedule your appointment ASAP. Reply BOOK now to secure a new slot. - {{business}}",
    ],
  },
  {
    type: "reschedule",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we totally understand needing to reschedule. Reply BOOK whenever you're ready — no rush!",
      "{{name}}, it's completely fine to reschedule. We're flexible! Reply BOOK to find a new time. - {{business}}",
    ],
  },

  // ═══════════════════════════════════════════
  // GENERIC (fallback for rewrite and misc)
  // ═══════════════════════════════════════════
  {
    type: "generic",
    tone: "friendly",
    templates: [
      "Hi {{name}}! Thanks for being a valued client of {{business}}. We're here for you — reply anytime!",
      "{{name}}, thanks for choosing {{business}}! Let us know how we can help. Reply anytime!",
    ],
  },
  {
    type: "generic",
    tone: "professional",
    templates: [
      "{{name}}, thank you for choosing {{business}}. We look forward to serving you. - {{business}}",
      "{{name}}, {{business}} appreciates your patronage. Please don't hesitate to reach out.",
    ],
  },
  {
    type: "generic",
    tone: "casual",
    templates: [
      "Hey {{name}}! Thanks for being awesome. Hit us up anytime! - {{business}}",
      "{{name}}, we're here for you. Text us anytime!",
    ],
  },
  {
    type: "generic",
    tone: "urgent",
    templates: [
      "{{name}}, please respond at your earliest convenience. - {{business}}",
    ],
  },
  {
    type: "generic",
    tone: "empathetic",
    templates: [
      "Hi {{name}}, we appreciate you. If there's anything we can do, we're just a message away. - {{business}}",
      "{{name}}, we're always here for you. Don't hesitate to reach out. - {{business}}",
    ],
  },
];
