import { eq, and, sql, desc, isNotNull, gt, lt, isNull, gte, lte } from "drizzle-orm";
import { leads, messages, automations } from "../../drizzle/schema";

import type { Db } from "../_core/context";
import { withQueryTimeout } from "./query.service";
import { sendSMS } from "../_core/sms";

export interface RecoveryAction {
  id: string;
  leadId: number;
  type: "reschedule" | "discount_offer" | "followup" | "re_engagement" | "waitlist";
  priority: "low" | "medium" | "high" | "urgent";
  message: string;
  scheduledAt: Date;
  executedAt?: Date;
  status: "pending" | "sent" | "failed" | "cancelled";
  estimatedRevenue: number;
  recoveryProbability: number;
}

export interface RecoveryCampaign {
  id: string;
  name: string;
  description: string;
  targetLeakageType: string;
  actions: RecoveryAction[];
  totalEstimatedRevenue: number;
  totalRecoveryProbability: number;
  status: "draft" | "active" | "completed" | "paused";
  createdAt: Date;
  executedAt?: Date;
}

export interface RecoveryResult {
  actionsExecuted: number;
  messagesSent: number;
  responsesReceived: number;
  appointmentsBooked: number;
  revenueRecovered: number;
  conversionRate: number;
  costPerRecovery: number;
}

export async function createRecoveryCampaign(
  db: Db, 
  tenantId: number, 
  leakageType: string, 
  options: {
    priority?: "low" | "medium" | "high" | "urgent";
    messageTemplate?: string;
    discountAmount?: number;
    scheduleDelay?: number; // hours
  } = {}
): Promise<RecoveryCampaign> {
  const campaignId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Get target leads for this leakage type
  const targetLeads = await getTargetLeadsForRecovery(db, tenantId, leakageType);
  
  const actions: RecoveryAction[] = [];
  const scheduleDelay = options.scheduleDelay || 0;
  const scheduledAt = new Date(Date.now() + scheduleDelay * 60 * 60 * 1000);

  if (Array.isArray(targetLeads)) {
    for (const lead of targetLeads) {
      const action = await createRecoveryAction(db, lead, leakageType, {
        priority: options.priority || "medium",
        messageTemplate: options.messageTemplate,
        discountAmount: options.discountAmount,
        scheduledAt
      });
      
      actions.push(action);
    }
  }

  const totalEstimatedRevenue = actions.reduce((sum, action) => sum + action.estimatedRevenue, 0);
  const totalRecoveryProbability = actions.length > 0 
    ? actions.reduce((sum, action) => sum + action.recoveryProbability, 0) / actions.length 
    : 0;

  const campaign: RecoveryCampaign = {
    id: campaignId,
    name: `${leakageType.replace('_', ' ').toUpperCase()} Recovery Campaign`,
    description: `Automated recovery campaign for ${leakageType.replace('_', ' ')} leakage`,
    targetLeakageType: leakageType,
    actions,
    totalEstimatedRevenue,
    totalRecoveryProbability,
    status: "draft",
    createdAt: new Date()
  };

  return campaign;
}

async function getTargetLeadsForRecovery(db: Db, tenantId: number, leakageType: string) {
  const conditions = [
    eq(leads.tenantId, tenantId)
  ];

  // Filter based on leakage type
  switch (leakageType) {
    case "no_show":
      conditions.push(
        eq(leads.status, "booked"),
        isNotNull(leads.appointmentAt),
        lt(leads.appointmentAt, new Date()),
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'no_show') IS NOT NULL`,
        gte(leads.appointmentAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      );
      break;

    case "cancellation":
      conditions.push(
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'cancelled') IS NOT NULL`,
        gte(leads.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      );
      break;

    case "last_minute":
      conditions.push(
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'cancelled') IS NOT NULL`,
        sql`${leads.appointmentAt} IS NOT NULL`,
        sql`TIMESTAMPDIFF(HOUR, ${leads.updatedAt}, ${leads.appointmentAt}) <= 24`,
        gte(leads.updatedAt, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) // Last 3 days
      );
      break;

    case "followup_missed":
      conditions.push(
        eq(leads.status, "contacted"),
        sql`${leads.appointmentAt} IS NULL`,
        sql`TIMESTAMPDIFF(HOUR, ${leads.lastMessageAt}, ${leads.updatedAt}) > 24`,
        lte(leads.lastMessageAt, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)) // Over 2 weeks
      );
      break;

    default:
      conditions.push(eq(leads.status, "new"));
      break;
  }

  return await withQueryTimeout("recovery.target-leads", db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      status: leads.status,
      appointmentAt: leads.appointmentAt,
      lastMessageAt: leads.lastMessageAt,
      tags: leads.tags,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt
    })
    .from(leads)
    .where(and(...conditions))
  );
}

async function createRecoveryAction(
  db: Db, 
  lead: any, 
  leakageType: string, 
  options: {
    priority: "low" | "medium" | "high" | "urgent";
    messageTemplate?: string;
    discountAmount?: number;
    scheduledAt: Date;
  }
): Promise<RecoveryAction> {
  const actionId = `action_${lead.id}_${Date.now()}`;
  const estimatedRevenue = lead.appointmentAt ? 250 : 200; // Default revenue
  
  let message = options.messageTemplate || "";
  let recoveryProbability = 0.5;
  let actionType: RecoveryAction["type"] = "followup";

  // Customize message and recovery probability based on leakage type
  switch (leakageType) {
    case "no_show":
      message = message || `Hi ${lead.name || 'there'}, we noticed you missed your appointment. We'd love to reschedule you at your convenience. Reply YES to book a new time.`;
      if (options.discountAmount) {
        message += ` As a courtesy, we'd like to offer you ${options.discountAmount}% off your next appointment!`;
      }
      recoveryProbability = 0.65;
      actionType = "reschedule";
      break;

    case "cancellation":
      message = message || `Hi ${lead.name || 'there'}, we're sorry you had to cancel your appointment. Is there anything we can do to better accommodate you?`;
      if (options.discountAmount) {
        message += ` We'd like to offer you ${options.discountAmount}% off your next booking as a thank you for your understanding.`;
      }
      recoveryProbability = 0.45;
      actionType = "re_engagement";
      break;

    case "last_minute":
      message = message || `Hi ${lead.name || 'there'}, we had a last-minute opening and thought of you. Would you like to grab this spot?`;
      recoveryProbability = 0.25;
      actionType = "waitlist";
      break;

    case "followup_missed":
      message = message || `Hi ${lead.name || 'there'}, following up on your inquiry. Are you still interested in booking an appointment?`;
      recoveryProbability = 0.85;
      actionType = "followup";
      break;

    case "abandoned_leads":
      message = message || `Hi ${lead.name || 'there'}, it's been a while since we last connected. We'd love to help you with your needs!`;
      if (options.discountAmount) {
        message += ` Here's ${options.discountAmount}% off to welcome you back!`;
      }
      recoveryProbability = 0.30;
      actionType = "re_engagement";
      break;

    default:
      message = message || `Hi ${lead.name || 'there'}, we'd love to hear from you!`;
      recoveryProbability = 0.40;
  }

  // Adjust recovery probability based on priority
  const priorityMultiplier = {
    urgent: 1.2,
    high: 1.1,
    medium: 1.0,
    low: 0.9
  };
  recoveryProbability *= priorityMultiplier[options.priority];

  return {
    id: actionId,
    leadId: lead.id,
    type: actionType,
    priority: options.priority,
    message,
    scheduledAt: options.scheduledAt,
    status: "pending",
    estimatedRevenue,
    recoveryProbability
  };
}

export async function executeRecoveryCampaign(
  db: Db, 
  tenantId: number, 
  campaignId: string
): Promise<RecoveryResult> {
  // This would normally fetch the campaign from storage
  // For now, we'll simulate execution
  
  let actionsExecuted = 0;
  let messagesSent = 0;
  let appointmentsBooked = 0;
  let revenueRecovered = 0;

  // Get pending actions for this campaign
  const pendingActions = await getPendingRecoveryActions(db, tenantId, campaignId);

  for (const action of pendingActions) {
    try {
      const result = await executeRecoveryAction(db, action);
      actionsExecuted++;
      
      if (result.messageSent) messagesSent++;
      if (result.appointmentBooked) {
        appointmentsBooked++;
        revenueRecovered += result.revenueAmount || 0;
      }
    } catch (error) {
      console.error(`Failed to execute recovery action ${action.id}:`, error);
    }
  }

  const conversionRate = messagesSent > 0 ? (appointmentsBooked / messagesSent) * 100 : 0;
  const costPerRecovery = appointmentsBooked > 0 ? (messagesSent * 0.05) / appointmentsBooked : 0; // Assuming $0.05 per SMS

  return {
    actionsExecuted,
    messagesSent,
    responsesReceived: 0, // Would track actual responses
    appointmentsBooked,
    revenueRecovered,
    conversionRate,
    costPerRecovery
  };
}

async function getPendingRecoveryActions(db: Db, tenantId: number, campaignId: string): Promise<RecoveryAction[]> {
  // This would normally fetch from a recovery_actions table
  // For now, we'll return mock data
  return [];
}

async function executeRecoveryAction(db: Db, action: RecoveryAction) {
  const result = {
    messageSent: false,
    appointmentBooked: false,
    revenueAmount: 0
  };

  try {
    // Send the recovery message
    const lead = await withQueryTimeout("recovery.lead-info", db
      .select({ phone: leads.phone, name: leads.name })
      .from(leads)
      .where(eq(leads.id, action.leadId))
      .limit(1));

    if (lead && lead.length > 0) {
      await sendSMS(lead[0].phone, action.message);
      result.messageSent = true;

      // Record the message in the database
      await withQueryTimeout("recovery.record-message", db
        .insert(messages)
        .values({
          tenantId: 1, // Would get from context
          leadId: action.leadId,
          direction: "outbound",
          body: action.message,
          fromNumber: "+1234567890", // Would get from tenant
          toNumber: lead[0].phone,
          status: "sent",
          provider: "twilio",
          createdAt: new Date()
        }));

      // Update lead's last message time
      await withQueryTimeout("recovery.update-lead", db
        .update(leads)
        .set({ lastMessageAt: new Date() })
        .where(eq(leads.id, action.leadId)));
    }
  } catch (error) {
    console.error(`Failed to send recovery message for action ${action.id}:`, error);
  }

  return result;
}

export async function createSmartRecoveryActions(
  db: Db, 
  tenantId: number, 
  leadId: number,
  leakageType: string,
  context?: {
    previousAttempts?: number;
    lastResponse?: string;
    preferredTime?: string;
  }
): Promise<RecoveryAction[]> {
  const lead = await withQueryTimeout("recovery.lead-details", db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      status: leads.status,
      appointmentAt: leads.appointmentAt,
      lastMessageAt: leads.lastMessageAt,
      tags: leads.tags,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1));

  if (!lead || lead.length === 0) {
    return [];
  }

  const actions: RecoveryAction[] = [];
  const baseLead = lead[0];
  const estimatedRevenue = baseLead.appointmentAt ? 250 : 200;

  // Create a sequence of recovery actions based on the leakage type and context
  switch (leakageType) {
    case "no_show":
      // Action 1: Immediate reschedule offer
      actions.push({
        id: `reschedule_${leadId}_1`,
        leadId,
        type: "reschedule",
        priority: "high",
        message: `Hi ${baseLead.name || 'there'}, we noticed you missed your appointment. We'd love to reschedule you. Reply YES to book a new time.`,
        scheduledAt: new Date(),
        status: "pending",
        estimatedRevenue,
        recoveryProbability: 0.65
      });

      // Action 2: Discount offer (if no response in 24 hours)
      if (!context?.previousAttempts || context.previousAttempts < 2) {
        actions.push({
          id: `discount_${leadId}_2`,
          leadId,
          type: "discount_offer",
          priority: "medium",
          message: `Hi ${baseLead.name || 'there'}, following up on your missed appointment. We'd like to offer you 20% off your next booking!`,
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: "pending",
          estimatedRevenue,
          recoveryProbability: 0.45
        });
      }
      break;

    case "followup_missed":
      // Action 1: Standard follow-up
      actions.push({
        id: `followup_${leadId}_1`,
        leadId,
        type: "followup",
        priority: "medium",
        message: `Hi ${baseLead.name || 'there'}, following up on your inquiry. Are you still interested in booking an appointment?`,
        scheduledAt: new Date(),
        status: "pending",
        estimatedRevenue: estimatedRevenue * 0.8, // Higher value for qualified leads
        recoveryProbability: 0.85
      });

      // Action 2: Alternative offer (if no response)
      actions.push({
        id: `alternative_${leadId}_2`,
        leadId,
        type: "re_engagement",
        priority: "low",
        message: `Hi ${baseLead.name || 'there'}, still thinking about it? We have some flexible scheduling options that might work better for you.`,
        scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: "pending",
        estimatedRevenue: estimatedRevenue * 0.6,
        recoveryProbability: 0.60
      });
      break;

    case "cancellation":
      // Action 1: Cancellation follow-up
      actions.push({
        id: `cancellation_followup_${leadId}_1`,
        leadId,
        type: "re_engagement",
        priority: "medium",
        message: `Hi ${baseLead.name || 'there'}, we're sorry you had to cancel. Is there anything we can do to better serve you in the future?`,
        scheduledAt: new Date(),
        status: "pending",
        estimatedRevenue: estimatedRevenue * 0.7,
        recoveryProbability: 0.45
      });
      break;
  }

  return actions;
}

export async function analyzeRecoveryEffectiveness(
  db: Db, 
  tenantId: number, 
  days: number = 30
): Promise<{
  totalActions: number;
  successfulRecoveries: number;
  totalRevenueRecovered: number;
  averageRecoveryTime: number;
  effectivenessByType: Record<string, {
    actions: number;
    recoveries: number;
    revenue: number;
    rate: number;
  }>;
  recommendations: string[];
}> {
  // This would analyze historical recovery data
  // For now, return mock analysis
  
  return {
    totalActions: 150,
    successfulRecoveries: 45,
    totalRevenueRecovered: 11250,
    averageRecoveryTime: 2.5, // days
    effectivenessByType: {
      no_show: { actions: 60, recoveries: 25, revenue: 6250, rate: 41.7 },
      followup_missed: { actions: 50, recoveries: 15, revenue: 3000, rate: 30.0 },
      cancellation: { actions: 40, recoveries: 5, revenue: 2000, rate: 12.5 }
    },
    recommendations: [
      "Increase follow-up frequency for no-shows",
      "Implement discount strategies for cancellations",
      "Add automated reminders for qualified leads"
    ]
  };
}
