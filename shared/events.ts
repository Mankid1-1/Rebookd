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
  data: Record<string, any>;
  tenantId: number;
  userId?: number;
  timestamp: Date;
}
