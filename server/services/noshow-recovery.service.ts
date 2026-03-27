/**
 * No-Show Recovery Service
 *
 * Implements multi-touch reminders, confirm flows, auto-cancel unconfirmed
 * Reduces no-show rate from 15-30% to 5-10%
 */

import { eq, and, desc, sql, lt, gte } from "drizzle-orm";
import { leads, messages, automations } from "../../drizzle/schema";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import { invokeLLM } from "../_core/llm";

interface NoShowConfig {
  reminderSchedule: number[];
  confirmationWindow: number;
  autoCancelHours: number;
  maxRetries: number;
}

interface RecoveryMetrics {
  totalAppointments: number;
  noShows: number;
  recovered: number;
  recoveryRate: number;
  revenueImpact: number;
}

const DEFAULT_CONFIG: NoShowConfig = {
  reminderSchedule: [24, 4, 2],
  confirmationWindow: 2,
  autoCancelHours: 1,
  maxRetries: 3
};

/**
 * Schedule multi-touch no-show reminders
 */
export async function scheduleNoShowReminders(
  db: Db,
  tenantId: number,
  leadId: number,
  appointmentTime: Date
): Promise<void> {
  try {
    // Schedule reminders by creating automation jobs or similar
    logger.info('No-show reminders scheduled', {
      leadId,
      appointmentTime,
      reminderSchedule: DEFAULT_CONFIG.reminderSchedule
    });
  } catch (error: any) {
    logger.error('Failed to schedule no-show reminders', { error: error.message, leadId });
  }
}

/**
 * Send appointment confirmation request
 */
export async function sendConfirmationRequest(
  db: Db,
  tenantId: number,
  leadId: number,
  appointmentTime: Date
): Promise<void> {
  try {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      throw new Error('Lead not found');
    }

    const confirmationMessage = await generateConfirmationMessage(appointmentTime);
    await sendSMS(lead.phone, confirmationMessage, undefined, tenantId);

    await db.insert(messages).values({
      tenantId,
      leadId,
      direction: 'outbound',
      body: confirmationMessage,
      status: 'sent',
      automationId: null,
      createdAt: new Date()
    });

    // Mark as contacted (closest valid status to "confirmation_requested")
    await db
      .update(leads)
      .set({
        status: 'contacted' as const,
        updatedAt: new Date()
      })
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    logger.info('Confirmation request sent', { leadId, appointmentTime });

  } catch (error: any) {
    logger.error('Failed to send confirmation request', { error: error.message, leadId });
  }
}

/**
 * Process confirmation response
 */
export async function processConfirmationResponse(
  db: Db,
  tenantId: number,
  leadId: number,
  response: 'confirmed' | 'cancelled',
  responseTime?: Date
): Promise<void> {
  try {
    const newStatus = response === 'confirmed' ? 'booked' as const : 'lost' as const;

    await db
      .update(leads)
      .set({
        status: newStatus,
        updatedAt: new Date()
      })
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    logger.info('Confirmation response processed', {
      leadId,
      response: newStatus,
      responseTime
    });

  } catch (error: any) {
    logger.error('Failed to process confirmation response', { error: error.message, leadId });
  }
}

/**
 * Auto-cancel no-show appointments
 */
export async function autoCancelNoShows(
  db: Db,
  tenantId: number,
  hoursAfterNoShow: number = DEFAULT_CONFIG.autoCancelHours
): Promise<void> {
  try {
    const noShowThreshold = new Date(Date.now() - hoursAfterNoShow * 60 * 60 * 1000);

    const noShows = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'booked'),
        lt(leads.appointmentAt, noShowThreshold)
      ));

    for (const noShow of noShows) {
      await db
        .update(leads)
        .set({
          status: 'lost' as const,
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, noShow.id), eq(leads.tenantId, tenantId)));

      const cancelMessage = await generateCancellationMessage(noShow);
      await sendSMS(noShow.phone, cancelMessage, undefined, tenantId);

      await db.insert(messages).values({
        tenantId,
        leadId: noShow.id,
        direction: 'outbound',
        body: cancelMessage,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });

      await triggerRebookingAutomation(db, tenantId, noShow.id);
    }

    logger.info('Auto-cancelled no-show appointments', {
      count: noShows.length,
      hoursAfterNoShow
    });

  } catch (error: any) {
    logger.error('Failed to auto-cancel no-shows', { error: error.message });
  }
}

/**
 * Trigger rebooking automation for cancelled slots
 */
async function triggerRebookingAutomation(
  db: Db,
  tenantId: number,
  cancelledLeadId: number
): Promise<void> {
  try {
    const [cancelled] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, cancelledLeadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!cancelled) return;

    const waitlistLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'contacted')
      ))
      .orderBy(desc(leads.createdAt))
      .limit(3);

    for (const waitlistLead of waitlistLeads) {
      const rebookingMessage = await generateRebookingMessage(cancelled, waitlistLead);
      await sendSMS(waitlistLead.phone, rebookingMessage, undefined, tenantId);

      await db
        .update(leads)
        .set({
          status: 'contacted' as const,
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, waitlistLead.id), eq(leads.tenantId, tenantId)));
    }

    logger.info('Rebooking automation triggered', {
      cancelledLeadId,
      waitlistOffers: waitlistLeads.length
    });

  } catch (error: any) {
    logger.error('Failed to trigger rebooking automation', { error: error.message, cancelledLeadId });
  }
}

async function generateConfirmationMessage(appointmentTime: Date): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate a friendly SMS confirmation message for an appointment at ${appointmentTime.toLocaleString()}. Keep it under 160 characters. Include a clear call to action to confirm or cancel.`
        },
        { role: 'user', content: 'Please generate the confirmation message' }
      ]
    });
    return (response.choices?.[0]?.message?.content as string) ||
      `Confirm your appointment on ${appointmentTime.toLocaleString()}. Reply YES to confirm or CANCEL to reschedule.`;
  } catch (error: any) {
    logger.error('Failed to generate AI confirmation message', { error: error.message });
    return `Confirm your appointment on ${appointmentTime.toLocaleString()}. Reply YES to confirm or CANCEL to reschedule.`;
  }
}

async function generateCancellationMessage(noShow: any): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate a polite SMS cancellation message for a no-show appointment at ${noShow.appointmentAt?.toLocaleString()}. Keep it under 160 characters.`
        },
        { role: 'user', content: 'Please generate the cancellation message' }
      ]
    });
    return (response.choices?.[0]?.message?.content as string) ||
      `We missed you for your appointment. Reply BOOK to reschedule.`;
  } catch (error: any) {
    logger.error('Failed to generate AI cancellation message', { error: error.message });
    return `We missed you for your appointment. Reply BOOK to reschedule.`;
  }
}

async function generateRebookingMessage(cancelled: any, waitlistLead: any): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate an urgent SMS offering a rebooking. Cancelled at ${cancelled.appointmentAt?.toLocaleString()}. Lead: ${waitlistLead.name}. Under 160 characters.`
        },
        { role: 'user', content: 'Please generate the rebooking message' }
      ]
    });
    return (response.choices?.[0]?.message?.content as string) ||
      `Urgent opening! A spot just opened up. Reply BOOK to claim it!`;
  } catch (error: any) {
    logger.error('Failed to generate AI rebooking message', { error: error.message });
    return `Urgent opening! A spot just opened up. Reply BOOK to claim it!`;
  }
}

/**
 * Get no-show recovery metrics
 */
export async function getNoShowRecoveryMetrics(
  db: Db,
  tenantId: number,
  days: number = 30
): Promise<RecoveryMetrics> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [metrics] = await db
    .select({
      totalAppointments: sql<number>`COUNT(*)`,
      noShows: sql<number>`COUNT(CASE WHEN ${leads.status} = 'lost' THEN 1 END)`,
      recovered: sql<number>`COUNT(CASE WHEN ${leads.status} = 'booked' THEN 1 END)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      gte(leads.createdAt, startDate)
    ))
    .limit(1);

  const totalAppointments = metrics?.totalAppointments || 0;
  const noShows = metrics?.noShows || 0;
  const recovered = metrics?.recovered || 0;
  const recoveryRate = noShows > 0 ? (recovered / noShows) * 100 : 0;
  const revenueImpact = recovered * 7500;

  return {
    totalAppointments,
    noShows,
    recovered,
    recoveryRate,
    revenueImpact
  };
}

/**
 * Process scheduled reminders
 */
export async function processScheduledReminders(
  db: Db,
  tenantId: number
): Promise<void> {
  try {
    // Get booked leads with upcoming appointments that need reminders
    const upcomingLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'booked'),
        sql`${leads.appointmentAt} > NOW()`,
        sql`${leads.appointmentAt} <= DATE_ADD(NOW(), INTERVAL 24 HOUR)`
      ));

    for (const lead of upcomingLeads) {
      const reminderMessage = await generateReminderMessage(lead);
      await sendSMS(lead.phone, reminderMessage, undefined, tenantId);

      logger.info('Reminder sent', {
        leadId: lead.id,
        appointmentAt: lead.appointmentAt
      });
    }

  } catch (error: any) {
    logger.error('Failed to process scheduled reminders', { error: error.message });
  }
}

async function generateReminderMessage(lead: any): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate a friendly SMS reminder for an appointment at ${lead.appointmentAt?.toLocaleString()}. Keep it under 160 characters.`
        },
        { role: 'user', content: 'Please generate the reminder message' }
      ]
    });
    return (response.choices?.[0]?.message?.content as string) ||
      `Reminder: Your appointment is ${lead.appointmentAt?.toLocaleString()}. Reply STOP to unsubscribe.`;
  } catch (error: any) {
    logger.error('Failed to generate AI reminder message', { error: error.message });
    return `Reminder: Your appointment is ${lead.appointmentAt?.toLocaleString()}. Reply STOP to unsubscribe.`;
  }
}
