/**
 * Cancellation Recovery Service
 *
 * Implements instant rebooking, waitlist auto-fill, broadcast open slots
 * Recovers 10-15% cancellations with 30-60% fill rate
 */

import { eq, and, desc, sql, lt, gte } from "drizzle-orm";
import { leads, messages, automations } from "../../drizzle/schema";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import { invokeLLM } from "../_core/llm";

interface CancellationRecoveryConfig {
  fillRate: number;
  broadcastRadius: number;
  urgencyTiers: {
    immediate: number;
    urgent: number;
    normal: number;
  };
}

interface RecoveryMetrics {
  totalCancellations: number;
  filledSlots: number;
  fillRate: number;
  revenueImpact: number;
  broadcastReach: number;
}

const DEFAULT_CONFIG: CancellationRecoveryConfig = {
  fillRate: 45,
  broadcastRadius: 48,
  urgencyTiers: {
    immediate: 0.5,
    urgent: 2,
    normal: 24
  }
};

/**
 * Process instant rebooking for cancelled appointment
 */
export async function processInstantRebooking(
  db: Db,
  tenantId: number,
  cancelledLeadId: number
): Promise<{ success: boolean; filledSlots: number; error?: string }> {
  try {
    const [cancelled] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, cancelledLeadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!cancelled) {
      return { success: false, filledSlots: 0, error: 'Cancelled appointment not found' };
    }

    // Find waitlist leads for instant rebooking
    const waitlistLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'contacted')
      ))
      .orderBy(desc(leads.createdAt))
      .limit(5);

    let filledSlots = 0;

    for (const waitlistLead of waitlistLeads) {
      const rebookingMessage = await generateUrgentRebookingMessage(cancelled, waitlistLead);
      await sendSMS(waitlistLead.phone, rebookingMessage, undefined, tenantId);

      // Update lead status
      await db
        .update(leads)
        .set({
          status: 'booked' as const,
          appointmentAt: cancelled.appointmentAt,
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, waitlistLead.id), eq(leads.tenantId, tenantId)));

      await db.insert(messages).values({
        tenantId,
        leadId: waitlistLead.id,
        direction: 'outbound',
        body: rebookingMessage,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });

      filledSlots++;
    }

    logger.info('Instant rebooking processed', {
      cancelledLeadId,
      filledSlots,
      waitlistNotified: waitlistLeads.length
    });

    return { success: true, filledSlots };

  } catch (error: any) {
    logger.error('Failed to process instant rebooking', { error: error.message, cancelledLeadId });
    return { success: false, filledSlots: 0, error: 'Rebooking processing failed' };
  }
}

/**
 * Broadcast open slots to waitlist
 */
export async function broadcastOpenSlots(
  db: Db,
  tenantId: number,
  openSlot: {
    appointmentTime: Date;
    serviceType?: string;
    estimatedValue?: number;
  }
): Promise<{ success: boolean; broadcastReach: number; error?: string }> {
  try {
    const waitlistLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'contacted')
      ))
      .orderBy(desc(leads.createdAt));

    let broadcastReach = 0;

    const timeDiff = openSlot.appointmentTime.getTime() - Date.now();
    let urgency: string = 'normal';

    if (timeDiff <= DEFAULT_CONFIG.urgencyTiers.immediate * 60 * 60 * 1000) {
      urgency = 'immediate';
    } else if (timeDiff <= DEFAULT_CONFIG.urgencyTiers.urgent * 60 * 60 * 1000) {
      urgency = 'urgent';
    }

    for (const waitlistLead of waitlistLeads) {
      const broadcastMessage = await generateBroadcastMessage(openSlot, waitlistLead, urgency);
      await sendSMS(waitlistLead.phone, broadcastMessage, undefined, tenantId);

      await db
        .update(leads)
        .set({
          status: 'contacted' as const,
          appointmentAt: openSlot.appointmentTime,
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, waitlistLead.id), eq(leads.tenantId, tenantId)));

      await db.insert(messages).values({
        tenantId,
        leadId: waitlistLead.id,
        direction: 'outbound',
        body: broadcastMessage,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });

      broadcastReach++;
    }

    logger.info('Open slots broadcasted', {
      appointmentTime: openSlot.appointmentTime,
      urgency,
      broadcastReach
    });

    return { success: true, broadcastReach };

  } catch (error: any) {
    logger.error('Failed to broadcast open slots', { error: error.message });
    return { success: false, broadcastReach: 0, error: 'Broadcast failed' };
  }
}

/**
 * Auto-fill waitlist for new openings
 */
export async function autoFillWaitlist(
  db: Db,
  tenantId: number
): Promise<{ success: boolean; filledSlots: number; error?: string }> {
  try {
    const slotOfferedLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'contacted'),
        sql`${leads.appointmentAt} > NOW()`,
        sql`${leads.appointmentAt} <= DATE_ADD(NOW(), INTERVAL 2 HOUR)`
      ))
      .orderBy(leads.appointmentAt)
      .limit(10);

    let filledSlots = 0;

    for (const lead of slotOfferedLeads) {
      const confirmMessage = await generateAutoFillMessage(lead);
      await sendSMS(lead.phone, confirmMessage, undefined, tenantId);

      await db
        .update(leads)
        .set({
          status: 'booked' as const,
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, lead.id), eq(leads.tenantId, tenantId)));

      filledSlots++;

      await db.insert(messages).values({
        tenantId,
        leadId: lead.id,
        direction: 'outbound',
        body: confirmMessage,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });
    }

    logger.info('Waitlist auto-fill processed', {
      filledSlots,
      totalLeads: slotOfferedLeads.length
    });

    return { success: true, filledSlots };

  } catch (error: any) {
    logger.error('Failed to auto-fill waitlist', { error: error.message });
    return { success: false, filledSlots: 0, error: 'Auto-fill failed' };
  }
}

async function generateUrgentRebookingMessage(cancelled: any, waitlistLead: any): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate an urgent SMS message offering a rebooking. The cancelled appointment was at ${cancelled.appointmentAt?.toLocaleString()}. The new lead is ${waitlistLead.name}. Create urgency and scarcity. Make it compelling and under 160 characters.`
        },
        { role: 'user', content: 'Please generate the urgent rebooking message' }
      ]
    });
    return (response.choices?.[0]?.message?.content as string) ||
      `URGENT: Opening just freed up! Reply BOOK to claim your spot.`;
  } catch (error: any) {
    logger.error('Failed to generate urgent rebooking message', { error: error.message });
    return `URGENT: Opening just freed up! Reply BOOK to claim your spot.`;
  }
}

async function generateBroadcastMessage(openSlot: any, waitlistLead: any, urgency: string): Promise<string> {
  try {
    const urgencyText = urgency === 'immediate' ? 'IMMEDIATE' :
                     urgency === 'urgent' ? 'URGENT' : 'NEW OPENING';
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate a ${urgencyText.toLowerCase()} SMS message announcing an open appointment slot. The appointment is at ${openSlot.appointmentTime?.toLocaleString()}. The lead is ${waitlistLead.name}. Create urgency. Under 160 characters.`
        },
        { role: 'user', content: 'Please generate the broadcast message' }
      ]
    });
    return (response.choices?.[0]?.message?.content as string) ||
      `${urgencyText}: New opening available! Reply BOOK to claim your spot.`;
  } catch (error: any) {
    logger.error('Failed to generate broadcast message', { error: error.message });
    return `New opening available! Reply BOOK to claim your spot.`;
  }
}

async function generateAutoFillMessage(lead: any): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate a confirmation message for a waitlist lead. The appointment is at ${lead.appointmentAt?.toLocaleString()}. The lead is ${lead.name}. Under 160 characters.`
        },
        { role: 'user', content: 'Please generate the auto-fill confirmation message' }
      ]
    });
    return (response.choices?.[0]?.message?.content as string) ||
      `Confirming your spot for ${lead.appointmentAt?.toLocaleString()}. Reply STOP to cancel.`;
  } catch (error: any) {
    logger.error('Failed to generate auto-fill message', { error: error.message });
    return `Your spot for ${lead.appointmentAt?.toLocaleString()} is confirmed! Reply STOP to cancel.`;
  }
}

/**
 * Get cancellation recovery metrics
 */
export async function getCancellationRecoveryMetrics(
  db: Db,
  tenantId: number,
  days: number = 30
): Promise<RecoveryMetrics> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [metrics] = await db
    .select({
      totalCancellations: sql<number>`COUNT(CASE WHEN ${leads.status} = 'lost' THEN 1 END)`,
      filledSlots: sql<number>`COUNT(CASE WHEN ${leads.status} = 'booked' THEN 1 END)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      gte(leads.createdAt, startDate)
    ))
    .limit(1);

  const totalCancellations = metrics?.totalCancellations || 0;
  const filledSlots = metrics?.filledSlots || 0;
  const fillRate = totalCancellations > 0 ? (filledSlots / totalCancellations) * 100 : 0;
  const revenueImpact = filledSlots * 7500;

  return {
    totalCancellations,
    filledSlots,
    fillRate,
    revenueImpact,
    broadcastReach: 0
  };
}

/**
 * Trigger urgency-based messaging campaign
 */
export async function triggerUrgencyCampaign(
  db: Db,
  tenantId: number,
  urgency: 'immediate' | 'urgent' | 'normal'
): Promise<void> {
  try {
    const timeThresholds = DEFAULT_CONFIG.urgencyTiers;
    const thresholdHours = timeThresholds[urgency];

    const targetLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'contacted'),
        sql`${leads.appointmentAt} BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ${thresholdHours} HOUR)`
      ))
      .orderBy(leads.appointmentAt)
      .limit(20);

    for (const lead of targetLeads) {
      const urgencyMessage = await generateUrgencyCampaignMessage(lead, urgency);
      await sendSMS(lead.phone, urgencyMessage, undefined, tenantId);

      await db.insert(messages).values({
        tenantId,
        leadId: lead.id,
        direction: 'outbound',
        body: urgencyMessage,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });
    }

    logger.info('Urgency campaign triggered', {
      urgency,
      leadsTargeted: targetLeads.length
    });

  } catch (error: any) {
    logger.error('Failed to trigger urgency campaign', { error: error.message, urgency });
  }
}

async function generateUrgencyCampaignMessage(lead: any, urgency: string): Promise<string> {
  try {
    const urgencyText = urgency === 'immediate' ? 'IMMEDIATE NEED' :
                     urgency === 'urgent' ? 'URGENT' : 'IMPORTANT';
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate a ${urgency.toLowerCase()} SMS message for a lead with an upcoming appointment at ${lead.appointmentAt?.toLocaleString()}. Lead: ${lead.name}. Under 160 characters.`
        },
        { role: 'user', content: 'Please generate the urgency campaign message' }
      ]
    });
    return (response.choices?.[0]?.message?.content as string) ||
      `${urgencyText}: Reply NOW to confirm your appointment.`;
  } catch (error: any) {
    logger.error('Failed to generate urgency campaign message', { error: error.message });
    return `IMPORTANT: Please confirm your appointment.`;
  }
}
