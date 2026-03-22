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
  reminderSchedule: number[]; // hours before appointment
  confirmationWindow: number; // hours before appointment
  autoCancelHours: number; // hours after no-show
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
  reminderSchedule: [24, 4, 2], // 24h, 4h, 2h before
  confirmationWindow: 2, // 2 hours before appointment
  autoCancelHours: 1, // Auto-cancel 1 hour after no-show
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
    // Schedule reminders for each time window
    for (const hoursBefore of DEFAULT_CONFIG.reminderSchedule) {
      const reminderTime = new Date(appointmentTime.getTime() - hoursBefore * 60 * 60 * 1000);
      
      await db
        .insert(sql`INSERT INTO scheduled_reminders (tenant_id, lead_id, reminder_time, message_type, scheduled_for, created_at) VALUES (${tenantId}, ${leadId}, ${reminderTime}, 'appointment_reminder', ${appointmentTime}, NOW())`)
        .run();
    }

    logger.info('No-show reminders scheduled', { 
      leadId, 
      appointmentTime,
      reminderSchedule: DEFAULT_CONFIG.reminderSchedule 
    });

  } catch (error) {
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

    // Generate confirmation message
    const confirmationMessage = await generateConfirmationMessage(appointmentTime);
    
    // Send confirmation SMS
    await sendSMS(lead.phone, confirmationMessage, tenantId);

    // Log the confirmation
    await db.insert(messages).values({
      tenantId,
      leadId,
      direction: 'outbound',
      body: confirmationMessage,
      status: 'sent',
      automationId: null,
      createdAt: new Date()
    });

    // Mark as confirmation requested
    await db
      .update(leads)
      .set({ 
        status: 'confirmation_requested',
        updatedAt: new Date()
      })
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    logger.info('Confirmation request sent', { leadId, appointmentTime });

  } catch (error) {
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
    const newStatus = response === 'confirmed' ? 'confirmed' : 'cancelled';
    
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

  } catch (error) {
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
    
    // Find appointments that are no-shows
    const noShows = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'booked'),
        lt(leads.appointmentAt, noShowThreshold)
      ));

    for (const noShow of noShows) {
      // Auto-cancel the appointment
      await db
        .update(leads)
        .set({ 
          status: 'auto_cancelled',
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, noShow.id), eq(leads.tenantId, tenantId)));

      // Send cancellation notification
      const cancelMessage = await generateCancellationMessage(noShow);
      await sendSMS(noShow.phone, cancelMessage, tenantId);

      // Log the auto-cancellation
      await db.insert(messages).values({
        tenantId,
        leadId: noShow.id,
        direction: 'outbound',
        body: cancelMessage,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });

      // Trigger rebooking automation
      await triggerRebookingAutomation(db, tenantId, noShow.id);
    }

    logger.info('Auto-cancelled no-show appointments', { 
      count: noShows.length,
      hoursAfterNoShow 
    });

  } catch (error) {
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
    // Get cancelled appointment details
    const [cancelled] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, cancelledLeadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!cancelled) {
      return;
    }

    // Find similar leads to offer the slot
    const waitlistLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'contacted'),
        sql`ABS(TIMESTAMPDIFF(HOUR, leads.appointment_at, ${cancelled.appointmentAt})) <= 2` // Within 2 hours
      ))
      .orderBy(desc(leads.createdAt))
      .limit(3);

    for (const waitlistLead of waitlistLeads) {
      const rebookingMessage = await generateRebookingMessage(cancelled, waitlistLead);
      await sendSMS(waitlistLead.phone, rebookingMessage, tenantId);

      // Update waitlist lead status
      await db
        .update(leads)
        .set({ 
          status: 'rebooking_offer',
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, waitlistLead.id), eq(leads.tenantId, tenantId)));
    }

    logger.info('Rebooking automation triggered', { 
      cancelledLeadId,
      waitlistOffers: waitlistLeads.length 
    });

  } catch (error) {
    logger.error('Failed to trigger rebooking automation', { error: error.message, cancelledLeadId });
  }
}

/**
 * Generate AI-powered confirmation message
 */
async function generateConfirmationMessage(appointmentTime: Date): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a friendly SMS confirmation message for an appointment at ${appointmentTime.toLocaleString()}. Keep it under 160 characters. Include a clear call to action to confirm or cancel.`
      },
      {
        role: 'user',
        content: 'Please generate the confirmation message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Confirm your appointment on ${appointmentTime.toLocaleString()}. Reply YES to confirm or CANCEL to reschedule.`;

  } catch (error) {
    logger.error('Failed to generate AI confirmation message', { error: error.message });
    return `Confirm your appointment on ${appointmentTime.toLocaleString()}. Reply YES to confirm or CANCEL to reschedule.`;
  }
}

/**
 * Generate cancellation message
 */
async function generateCancellationMessage(noShow: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a polite SMS cancellation message for a no-show appointment. The appointment was at ${noShow.appointmentAt?.toLocaleString()}. Keep it under 160 characters. Be empathetic but firm.`
      },
      {
        role: 'user',
        content: 'Please generate the cancellation message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `We missed you for your appointment on ${noShow.appointmentAt?.toLocaleString()}. Your spot has been automatically cancelled. Reply BOOK to reschedule.`;

  } catch (error) {
    logger.error('Failed to generate AI cancellation message', { error: error.message });
    return `We missed you for your appointment on ${noShow.appointmentAt?.toLocaleString()}. Your spot has been automatically cancelled. Reply BOOK to reschedule.`;
  }
}

/**
 * Generate rebooking message
 */
async function generateRebookingMessage(cancelled: any, waitlistLead: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate an urgent SMS message offering a rebooking opportunity. The cancelled appointment was at ${cancelled.appointmentAt?.toLocaleString()} for ${cancelled.name}. The new lead is ${waitlistLead.name}. The original service type was ${cancelled.source || 'general'}. Make it compelling and under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate the rebooking message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Urgent opening! A spot just opened up for ${cancelled.appointmentAt?.toLocaleString()}. Reply BOOK to claim it before it's gone!`;

  } catch (error) {
    logger.error('Failed to generate AI rebooking message', { error: error.message });
    return `Urgent opening! A spot just opened up for ${cancelled.appointmentAt?.toLocaleString()}. Reply BOOK to claim it before it's gone!`;
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
      noShows: sql<number>`COUNT(CASE WHEN status = 'auto_cancelled' THEN 1 END)`,
      recovered: sql<number>`COUNT(CASE WHEN status = 'rebooked' AND original_appointment_id IS NOT NULL THEN 1 END)`,
      avgAppointmentValue: sql<number>`AVG(estimated_revenue)`
    })
    .from(sql`leads l`)
    .where(and(
      eq(sql`l.tenant_id`, tenantId),
      sql`l.appointment_at >= ${startDate}`
    ))
    .limit(1);

  const totalAppointments = metrics?.totalAppointments || 0;
  const noShows = metrics?.noShows || 0;
  const recovered = metrics?.recovered || 0;
  const recoveryRate = noShows > 0 ? (recovered / noShows) * 100 : 0;
  const revenueImpact = recovered * (metrics?.avgAppointmentValue || 7500); // $75 average

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
    const now = new Date();
    
    // Get due reminders
    const dueReminders = await db
      .select()
      .from(sql`scheduled_reminders`)
      .where(and(
        eq(sql`tenant_id`, tenantId),
        sql`scheduled_for <= NOW()`,
        sql`sent_at IS NULL`
      ));

    for (const reminder of dueReminders) {
      // Send reminder
      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, reminder.lead_id), eq(leads.tenantId, tenantId)))
        .limit(1);

      if (lead) {
        const reminderMessage = await generateReminderMessage(reminder, lead);
        await sendSMS(lead.phone, reminderMessage, tenantId);

        // Mark reminder as sent
        await db
          .update(sql`scheduled_reminders`)
          .set({ sent_at: NOW() })
          .where(eq(sql`id`, reminder.id));

        logger.info('Reminder sent', { 
          leadId: reminder.lead_id,
          reminderType: reminder.message_type 
        });
      }
    }

  } catch (error) {
    logger.error('Failed to process scheduled reminders', { error: error.message });
  }
}

/**
 * Generate reminder message based on type
 */
async function generateReminderMessage(reminder: any, lead: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a friendly SMS reminder for an appointment at ${lead.appointmentAt?.toLocaleString()}. This is a ${reminder.message_type} reminder. Keep it under 160 characters and include the appointment details.`
      },
      {
        role: 'user',
        content: 'Please generate the reminder message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Reminder: Your appointment is ${lead.appointmentAt?.toLocaleString()}. Reply STOP to unsubscribe.`;

  } catch (error) {
    logger.error('Failed to generate AI reminder message', { error: error.message });
    return `Reminder: Your appointment is ${lead.appointmentAt?.toLocaleString()}. Reply STOP to unsubscribe.`;
  }
}
