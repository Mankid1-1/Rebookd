export type EventType =
  | "lead.created"
  | "lead.imported"
  | "lead.qualified"
  | "lead.win_back_due"
  | "lead.win_back_30d"
  | "lead.vip_winback_45d"
  | "lead.vip_winback_90d"
  | "lead.birthday"
  | "lead.loyalty_milestone"
  | "lead.feedback_due"
  | "lead.upsell_due"
  | "lead.next_visit_due"
  | "lead.followup_due"
  | "appointment.booked"
  | "appointment.confirmation_chase"
  | "appointment.reminder_24h"
  | "appointment.reminder_2h"
  | "appointment.no_show"
  | "appointment.no_show_rebook"
  | "appointment.cancelled"
  | "appointment.cancellation_rescue_7d"
  | "appointment.rescheduled"
  | "call.missed"
  | "call.missed_followup"
  | "call.missed_final"
  | "message.received"
  | "message.sent"
  | "message.delivery_failed"
  | "calendar.synced"
  | "review.requested"
  | "waitlist.slot_opened"
  | "automation.triggered"
  | "user.created"
  | "subscription.created"
  | "subscription.updated"
  // Review routing events (Feature 1)
  | "review.rating_received"
  | "review.positive_routed"
  | "review.negative_captured"
  | "review.feedback_submitted"
  // AI SMS events (Feature 2)
  | "ai.sms_generated"
  | "ai.sms_fallback"
  // Booking page events (Feature 4)
  | "booking.page_viewed"
  | "booking.slot_selected"
  | "booking.created"
  | "booking.cancelled"
  // Waitlist auto-fill events (Feature 3)
  | "waitlist.offer_sent"
  | "waitlist.offer_accepted"
  | "waitlist.offer_declined"
  | "waitlist.offer_expired"
  | "waitlist.slot_filled";

export interface EventPayload {
  id?: string;
  type: EventType;
  tenantId: number;
  data: Record<string, unknown>;
  userId?: number;
  timestamp: Date;
}
