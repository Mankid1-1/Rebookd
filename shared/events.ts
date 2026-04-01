export type EventType =
  | "lead.created"
  | "lead.imported"
  | "appointment.booked"
  | "appointment.no_show"
  | "appointment.cancelled"
  | "appointment.rescheduled"
  | "message.received"
  | "message.sent"
  | "calendar.synced"
  | "call.missed"
  | "lead.win_back_due"
  | "lead.birthday"
  | "lead.loyalty_milestone"
  | "review.requested"
  | "waitlist.slot_opened"
  | "automation.triggered"
  | "user.created"
  | "subscription.created"
  | "subscription.updated";

export interface EventPayload {
  id?: string;
  type: EventType;
  tenantId: number;
  data: Record<string, unknown>;
  userId?: number;
  timestamp: Date;
}
