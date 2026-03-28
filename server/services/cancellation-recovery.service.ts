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
  fillRate: number; // 30-60% target fill rate
  broadcastRadius: number; // hours to broadcast
  urgencyTiers: {
    immediate: number; // hours
    urgent: number; // hours
    normal: number; // hours
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
  fillRate: 45, // 45% target fill rate
  broadcastRadius: 48, // 48 hours broadcast radius
  urgencyTiers: {
    immediate: 0.5, // 30 minutes
    urgent: 2, // 2 hours
    normal: 24 // 24 hours
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
      return { success: false, error: 'Cancelled appointment not found' };
    }

    // Find waitlist leads for instant rebooking
    const waitlistLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'contacted'),
        sql`ABS(TIMESTAMPDIFF(HOUR, leads.appointment_at, ${cancelled.appointmentAt})) <= 2` // Within 2 hours
      ))
      .orderBy(desc(leads.createdAt))
      .limit(5);

    let filledSlots = 0;
    
    for (const waitlistLead of waitlistLeads) {
      // Generate urgent rebooking message
      const rebookingMessage = await generateUrgentRebookingMessage(cancelled, waitlistLead);
      await sendSMS(waitlistLead.phone, rebookingMessage, tenantId);

      // Update lead status and assign the slot
      await db
        .update(leads)
        .set({ 
          status: 'rebooked',
          appointmentAt: cancelled.appointmentAt,
          estimatedRevenue: cancelled.estimatedRevenue,
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, waitlistLead.id), eq(leads.tenantId, tenantId)));

      // Log the rebooking
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

  } catch (error) {
    logger.error('Failed to process instant rebooking', { error: error.message, cancelledLeadId });
    return { success: false, error: 'Rebooking processing failed' };
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
    // Find all waitlist leads
    const waitlistLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'contacted'),
        sql`leads.appointment_at IS NULL OR leads.appointment_at > DATE_SUB(NOW(), INTERVAL ${DEFAULT_CONFIG.broadcastRadius} HOUR)`
      ))
      .orderBy(desc(leads.createdAt));

    let broadcastReach = 0;
    
    // Categorize leads by urgency based on timing
    const timeDiff = openSlot.appointmentTime.getTime() - Date.now();
    let urgency: 'normal';
    
    if (timeDiff <= DEFAULT_CONFIG.urgencyTiers.immediate * 60 * 60 * 1000) {
      urgency = 'immediate';
    } else if (timeDiff <= DEFAULT_CONFIG.urgencyTiers.urgent * 60 * 60 * 1000) {
      urgency = 'urgent';
    }

    // Send broadcast messages based on urgency
    for (const waitlistLead of waitlistLeads) {
      const broadcastMessage = await generateBroadcastMessage(openSlot, waitlistLead, urgency);
      await sendSMS(waitlistLead.phone, broadcastMessage, tenantId);

      // Update lead with slot assignment
      await db
        .update(leads)
        .set({ 
          status: 'slot_offered',
          appointmentAt: openSlot.appointmentTime,
          estimatedRevenue: openSlot.estimatedValue || waitlistLead.estimatedRevenue,
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, waitlistLead.id), eq(leads.tenantId, tenantId)));

      // Log the broadcast
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

  } catch (error) {
    logger.error('Failed to broadcast open slots', { error: error.message });
    return { success: false, error: 'Broadcast failed' };
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
    // Find leads that have been offered slots but not confirmed
    const slotOfferedLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'slot_offered'),
        sql`leads.appointment_at > NOW()`,
        sql`leads.appointment_at <= DATE_SUB(NOW(), INTERVAL 2 HOUR)` // Within 2 hours
      ))
      .orderBy(leads.appointmentAt)
      .limit(10);

    let filledSlots = 0;
    
    for (const lead of slotOfferedLeads) {
      // Generate urgency-based confirmation message
      const confirmMessage = await generateAutoFillMessage(lead);
      await sendSMS(lead.phone, confirmMessage, tenantId);

      // Auto-confirm if no response (assuming they want the slot)
      setTimeout(() => {
        db.update(leads)
          .set({
            status: 'booked',
            updatedAt: new Date()
          })
          .where(and(eq(leads.id, lead.id), eq(leads.tenantId, tenantId)))
          .then(() => {
            filledSlots++;
            logger.info('Auto-filled waitlist slot', { leadId: lead.id });
          })
          .catch((err) => {
            logger.error('Auto-fill waitlist slot failed', { error: (err as Error).message, leadId: lead.id });
          });
      }, 30 * 60 * 1000); // 30 minutes

      // Log the auto-fill
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

  } catch (error) {
    logger.error('Failed to auto-fill waitlist', { error: error.message });
    return { success: false, error: 'Auto-fill failed' };
  }
}

/**
 * Generate urgent rebooking message
 */
async function generateUrgentRebookingMessage(cancelled: any, waitlistLead: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate an urgent SMS message offering a rebooking. The cancelled appointment was at ${cancelled.appointmentAt?.toLocaleString()} for ${cancelled.name || 'a service'}. The new lead is ${waitlistLead.name}. The appointment time is ${cancelled.appointmentAt?.toLocaleString()}. Create urgency and scarcity. Make it compelling and under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate the urgent rebooking message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `URGENT: Opening just freed up for ${cancelled.appointmentAt?.toLocaleString()}! Reply BOOK now to claim ${waitlistLead.name}'s spot before it's gone!`;

  } catch (error) {
    logger.error('Failed to generate urgent rebooking message', { error: error.message });
    return `URGENT: Opening just freed up! Reply BOOK to claim your spot.`;
  }
}

/**
 * Generate broadcast message
 */
async function generateBroadcastMessage(
  openSlot: any,
  waitlistLead: any,
  urgency: string
): Promise<string> {
  try {
    const urgencyText = urgency === 'immediate' ? 'IMMEDIATE' : 
                     urgency === 'urgent' ? 'URGENT' : 'NEW OPENING';

    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a ${urgencyText.toLowerCase()} SMS message announcing an open appointment slot. The appointment is at ${openSlot.appointmentTime?.toLocaleString()}. The lead is ${waitlistLead.name}. Create urgency based on timing. Make it compelling and under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate the broadcast message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `${urgencyText}: New opening at ${openSlot.appointmentTime?.toLocaleString()}! Reply BOOK to claim ${waitlistLead.name}'s spot.`;

  } catch (error) {
    logger.error('Failed to generate broadcast message', { error: error.message });
    return `New opening available! Reply BOOK to claim your spot.`;
  }
}

/**
 * Generate auto-fill confirmation message
 */
async function generateAutoFillMessage(lead: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a confirmation message for a waitlist lead who was offered a slot. The appointment is at ${lead.appointmentAt?.toLocaleString()}. The lead is ${lead.name}. Create urgency and assume they want the slot. Make it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate the auto-fill confirmation message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Confirming your spot for ${lead.appointmentAt?.toLocaleString()}. Reply STOP to cancel.`;

  } catch (error) {
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
      totalCancellations: sql<number>`COUNT(CASE WHEN status = 'cancelled' THEN 1 END)`,
      filledSlots: sql<number>`COUNT(CASE WHEN status = 'rebooked' AND original_appointment_id IS NOT NULL THEN 1 END)`,
      avgSlotValue: sql<number>`AVG(estimated_revenue)`
    })
    .from(sql`leads l`)
    .where(and(
      eq(sql`l.tenant_id`, tenantId),
      sql`l.created_at >= ${startDate}`
    ))
    .limit(1);

  const totalCancellations = metrics?.totalCancellations || 0;
  const filledSlots = metrics?.filledSlots || 0;
  const fillRate = totalCancellations > 0 ? (filledSlots / totalCancellations) * 100 : 0;
  const revenueImpact = filledSlots * (metrics?.avgSlotValue || 7500); // $75 average

  return {
    totalCancellations,
    filledSlots,
    fillRate,
    revenueImpact
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
    // Find leads that match urgency criteria
    const timeThresholds = DEFAULT_CONFIG.urgencyTiers;
    const thresholdHours = timeThresholds[urgency];
    
    const targetLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'contacted'),
        sql`leads.appointment_at BETWEEN NOW() AND DATE_SUB(NOW(), INTERVAL ${thresholdHours} HOUR)`
      ))
      .orderBy(leads.appointmentAt)
      .limit(20);

    for (const lead of targetLeads) {
      const urgencyMessage = await generateUrgencyCampaignMessage(lead, urgency);
      await sendSMS(lead.phone, urgencyMessage, tenantId);

      // Log the campaign message
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

  } catch (error) {
    logger.error('Failed to trigger urgency campaign', { error: error.message, urgency });
  }
}

/**
 * Generate urgency campaign message
 */
async function generateUrgencyCampaignMessage(lead: any, urgency: string): Promise<string> {
  try {
    const urgencyText = urgency === 'immediate' ? 'IMMEDIATE NEED' : 
                     urgency === 'urgent' ? 'URGENT' : 'IMPORTANT';

    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a ${urgency.toLowerCase()} SMS message for a lead with an upcoming appointment. The appointment is at ${lead.appointmentAt?.toLocaleString()}. The lead is ${lead.name}. Create urgency and call to action. Make it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate the urgency campaign message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `${urgencyText}: Reply NOW to confirm your appointment on ${lead.appointmentAt?.toLocaleString()}.`;

  } catch (error) {
    logger.error('Failed to generate urgency campaign message', { error: error.message });
    return `${urgencyText}: Please confirm your appointment.`;
  }
}
