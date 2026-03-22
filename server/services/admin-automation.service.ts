/**
 * Admin Time → Revenue Redeployment Service
 * 
 * Implements automated confirmations, follow-ups, self-service rescheduling
 * Saves 10-20 hours/week of admin time
 */

import { eq, and, desc, sql, lt, gte } from "drizzle-orm";
import { leads, messages, automations } from "../../drizzle/schema";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import { invokeLLM } from "../_core/llm";

interface AdminAutomationConfig {
  confirmationWindow: number; // hours before appointment
  reschedulingWindow: number; // hours after cancellation
  followUpSchedule: number[]; // days after appointment
  selfServiceEnabled: boolean;
}

interface AdminTimeMetrics {
  totalAppointments: number;
  automatedConfirmations: number;
  selfServiceReschedules: number;
  timeSaved: number; // hours
  revenueImpact: number;
}

const DEFAULT_CONFIG: AdminAutomationConfig = {
  confirmationWindow: 24, // 24 hours before
  reschedulingWindow: 48, // 48 hours after
  followUpSchedule: [1, 3, 7], // 1, 3, 7 days after
  selfServiceEnabled: true
};

/**
 * Process automated confirmations
 */
export async function processAutomatedConfirmations(
  db: Db,
  tenantId: number
): Promise<{ success: boolean; confirmationsSent: number; error?: string }> {
  try {
    // Find appointments needing confirmation
    const confirmationWindow = new Date(Date.now() + DEFAULT_CONFIG.confirmationWindow * 60 * 60 * 1000);
    
    const appointmentsToConfirm = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'booked'),
        gte(leads.appointmentAt, new Date()),
        lt(leads.appointmentAt, confirmationWindow),
        sql`last_confirmation_sent IS NULL`
      ))
      .orderBy(leads.appointmentAt)
      .limit(50);

    let confirmationsSent = 0;

    for (const appointment of appointmentsToConfirm) {
      // Generate confirmation message
      const confirmationMessage = await generateConfirmationMessage(appointment);
      await sendSMS(appointment.phone, confirmationMessage, tenantId);

      // Update appointment with confirmation sent
      await db
        .update(leads)
        .set({ 
          lastConfirmationSent: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, appointment.id), eq(leads.tenantId, tenantId)));

      // Log confirmation
      await db.insert(messages).values({
        tenantId,
        leadId: appointment.id,
        direction: 'outbound',
        body: confirmationMessage,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });

      confirmationsSent++;
    }

    logger.info('Automated confirmations processed', { 
      confirmationsSent,
      confirmationWindow: DEFAULT_CONFIG.confirmationWindow 
    });

    return { success: true, confirmationsSent };

  } catch (error) {
    logger.error('Failed to process automated confirmations', { error: error.message });
    return { success: false, error: 'Confirmation processing failed' };
  }
}

/**
 * Process automated follow-ups
 */
export async function processAutomatedFollowUps(
  db: Db,
  tenantId: number
): Promise<{ success: boolean; followUpsSent: number; error?: string }> {
  try {
    let followUpsSent = 0;

    for (const daysAfter of DEFAULT_CONFIG.followUpSchedule) {
      const followUpDate = new Date(Date.now() - daysAfter * 24 * 60 * 60 * 1000);
      
      // Find appointments needing follow-up
      const appointmentsToFollowUp = await db
        .select()
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, 'completed'),
          gte(leads.updatedAt, followUpDate),
          lt(leads.updatedAt, new Date(followUpDate.getTime() + 24 * 60 * 60 * 1000)), // Within 24 hour window
          sql`follow_up_count < ${daysAfter}` // Haven't sent this follow-up yet
        ))
        .orderBy(leads.updatedAt)
        .limit(30);

      for (const appointment of appointmentsToFollowUp) {
        // Generate follow-up message
        const followUpMessage = await generateFollowUpMessage(appointment, daysAfter);
        await sendSMS(appointment.phone, followUpMessage, tenantId);

        // Update appointment follow-up count
        await db
          .update(leads)
          .set({ 
            followUpCount: sql`follow_up_count + 1`,
            lastFollowUpAt: new Date(),
            updatedAt: new Date()
          })
          .where(and(eq(leads.id, appointment.id), eq(leads.tenantId, tenantId)));

        // Log follow-up
        await db.insert(messages).values({
          tenantId,
          leadId: appointment.id,
          direction: 'outbound',
          body: followUpMessage,
          status: 'sent',
          automationId: null,
          createdAt: new Date()
        });

        followUpsSent++;
      }
    }

    logger.info('Automated follow-ups processed', { 
      followUpsSent,
      schedule: DEFAULT_CONFIG.followUpSchedule 
    });

    return { success: true, followUpsSent };

  } catch (error) {
    logger.error('Failed to process automated follow-ups', { error: error.message });
    return { success: false, error: 'Follow-up processing failed' };
  }
}

/**
 * Process self-service rescheduling
 */
export async function processSelfServiceRescheduling(
  db: Db,
  tenantId: number
): Promise<{ success: boolean; reschedulesProcessed: number; error?: string }> {
  try {
    if (!DEFAULT_CONFIG.selfServiceEnabled) {
      return { success: true, reschedulesProcessed: 0 };
    }

    // Find appointments eligible for self-service rescheduling
    const reschedulingWindow = new Date(Date.now() - DEFAULT_CONFIG.reschedulingWindow * 60 * 60 * 1000);
    
    const appointmentsToReschedule = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'cancelled'),
        gte(leads.updatedAt, reschedulingWindow),
        sql`self_service_offered IS NULL` // Haven't offered self-service yet
      ))
      .orderBy(desc(leads.updatedAt))
      .limit(20);

    let reschedulesProcessed = 0;

    for (const appointment of appointmentsToReschedule) {
      // Generate self-service rescheduling message
      const rescheduleMessage = await generateRescheduleMessage(appointment);
      await sendSMS(appointment.phone, rescheduleMessage, tenantId);

      // Update appointment with self-service offer
      await db
        .update(leads)
        .set({ 
          selfServiceOffered: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, appointment.id), eq(leads.tenantId, tenantId)));

      // Log self-service offer
      await db.insert(messages).values({
        tenantId,
        leadId: appointment.id,
        direction: 'outbound',
        body: rescheduleMessage,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });

      reschedulesProcessed++;
    }

    logger.info('Self-service rescheduling processed', { 
      reschedulesProcessed,
      reschedulingWindow: DEFAULT_CONFIG.reschedulingWindow 
    });

    return { success: true, reschedulesProcessed };

  } catch (error) {
    logger.error('Failed to process self-service rescheduling', { error: error.message });
    return { success: false, error: 'Rescheduling processing failed' };
  }
}

/**
 * Generate confirmation message
 */
async function generateConfirmationMessage(appointment: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a friendly appointment confirmation SMS. The appointment is at ${appointment.appointmentAt?.toLocaleString()} for ${appointment.name}. Include details like date, time, and any preparation needed. Create excitement and confirmation. Keep it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate a confirmation message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Confirming your appointment on ${appointment.appointmentAt?.toLocaleString()}. We're excited to see you!`;

  } catch (error) {
    logger.error('Failed to generate confirmation message', { error: error.message });
    return `Confirming your appointment on ${appointment.appointmentAt?.toLocaleString()}. We're excited to see you!`;
  }
}

/**
 * Generate follow-up message
 */
async function generateFollowUpMessage(appointment: any, daysAfter: number): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a friendly follow-up SMS. The appointment was ${daysAfter} days ago at ${appointment.appointmentAt?.toLocaleString()} for ${appointment.name}. Ask about their experience and encourage future bookings. Create value and personalization. Keep it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate a follow-up message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Hi ${appointment.name}, how was your appointment ${daysAfter} days ago? We'd love to see you again!`;

  } catch (error) {
    logger.error('Failed to generate follow-up message', { error: error.message });
    return `Hi ${appointment.name}, how was your appointment ${daysAfter} days ago? We'd love to see you again!`;
  }
}

/**
 * Generate reschedule message
 */
async function generateRescheduleMessage(appointment: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a convenient self-service rescheduling SMS. The cancelled appointment was for ${appointment.name}. Include a link or instructions for them to reschedule at their convenience. Make it easy and helpful. Keep it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate a reschedule message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Hi ${appointment.name}, sorry about the cancellation! Reschedule easily: reply with preferred times.`;

  } catch (error) {
    logger.error('Failed to generate reschedule message', { error: error.message });
    return `Hi ${appointment.name}, sorry about the cancellation! Reschedule easily: reply with preferred times.`;
  }
}

/**
 * Get admin automation metrics
 */
export async function getAdminAutomationMetrics(
  db: Db,
  tenantId: number,
  days: number = 30
): Promise<AdminTimeMetrics> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [metrics] = await db
    .select({
      totalAppointments: sql<number>`COUNT(*)`,
      automatedConfirmations: sql<number>`COUNT(CASE WHEN last_confirmation_sent IS NOT NULL THEN 1 END)`,
      selfServiceReschedules: sql<number>`COUNT(CASE WHEN self_service_offered IS NOT NULL THEN 1 END)`,
      avgAppointmentValue: sql<number>`AVG(estimated_revenue)`
    })
    .from(sql`leads l`)
    .where(and(
      eq(sql`l.tenant_id`, tenantId),
      sql`l.created_at >= ${startDate}`
    ))
    .limit(1);

  const totalAppointments = metrics?.totalAppointments || 0;
  const automatedConfirmations = metrics?.automatedConfirmations || 0;
  const selfServiceReschedules = metrics?.selfServiceReschedules || 0;
  
  // Calculate time saved (assuming 5 minutes per automated task)
  const automatedTasks = automatedConfirmations + selfServiceReschedules;
  const timeSaved = automatedTasks * 5; // 5 minutes per task
  
  // Convert to hours
  const timeSavedHours = timeSaved / 60;
  
  // Calculate revenue impact (assuming $25/hour admin time value)
  const revenueImpact = timeSavedHours * 2500; // $25 in cents

  return {
    totalAppointments,
    automatedConfirmations,
    selfServiceReschedules,
    timeSaved: timeSavedHours,
    revenueImpact
  };
}

/**
 * Trigger admin automation campaign
 */
export async function triggerAdminAutomationCampaign(
  db: Db,
  tenantId: number,
  campaignType: 'confirmation' | 'followup' | 'rescheduling'
): Promise<void> {
  try {
    switch (campaignType) {
      case 'confirmation':
        await processAutomatedConfirmations(db, tenantId);
        break;
      case 'followup':
        await processAutomatedFollowUps(db, tenantId);
        break;
      case 'rescheduling':
        await processSelfServiceRescheduling(db, tenantId);
        break;
    }

    logger.info('Admin automation campaign triggered', { 
      campaignType,
      tenantId 
    });

  } catch (error) {
    logger.error('Failed to trigger admin automation campaign', { error: error.message, campaignType });
  }
}
