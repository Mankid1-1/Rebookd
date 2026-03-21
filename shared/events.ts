export type EventType =
  | "lead.created"
  | "appointment.booked"
  | "appointment.no_show"
  | "appointment.cancelled"
  | "message.received"
  | "message.sent";

export interface EventPayload {
  id?: string;
  type: EventType;
  tenantId: number;
  data: Record<string, unknown>;
  userId?: number;
  timestamp: Date;
}
