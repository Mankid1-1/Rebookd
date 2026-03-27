/**
 * After-Hours & Missed Opportunities Service
 *
 * Implements after-hours auto replies, instant booking links
 * Captures 10-30% more leads 24/7
 */

import { eq, and, desc, sql, lt, gte } from "drizzle-orm";
import { leads, messages, automations } from "../../drizzle/schema";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import { invokeLLM } from "../_core/llm";
import crypto from "crypto";

interface AfterHoursConfig {
  businessHours: {
    start: string; // "08:00"
    end: string;   // "18:00"
    timezone: string;
  };
  responseDelay: number; // minutes
  maxQueueSize: number;
}

interface AfterHoursMetrics {
  totalLeads: number;
  afterHoursLeads: number;
  capturedLeads: number;
  captureRate: number;
  revenueImpact: number;
}

const DEFAULT_CONFIG: AfterHoursConfig = {
  businessHours: {
    start: "08:00",
    end: "18:00",
    timezone: "America/New_York"
  },
  responseDelay: 5, // 5 minutes
  maxQueueSize: 100
};

/**
 * Process incoming lead with after-hours handling
 */
export async function processAfterHoursLead(
  db: Db,
  tenantId: number,
  leadData: {
    name?: string;
    phone: string;
    email?: string;
    source?: string;
  }
): Promise<{ success: boolean; bookingLink?: string; isAfterHours: boolean }> {
  try {
    const isAfterHours = isOutsideBusinessHours();

    // Check if lead already exists
    const [existingLead] = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        sql`${leads.phoneHash} = HASH(${leadData.phone})`
      ))
      .limit(1);

    if (existingLead) {
      logger.info('Lead already exists, updating contact', { leadId: existingLead.id });
      return { success: true, isAfterHours };
    }

    // Create new lead
    const { hashPhoneNumber } = await import("../_core/phone");
    const phoneHash = hashPhoneNumber(leadData.phone);

    await db
      .insert(leads)
      .values({
        tenantId,
        name: leadData.name,
        phone: leadData.phone,
        phoneHash,
        email: leadData.email,
        source: leadData.source || 'after_hours',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date()
      });

    // Get the newly created lead
    const [newLead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.phoneHash, phoneHash)))
      .limit(1);

    if (!newLead) {
      return { success: false, isAfterHours };
    }

    // Generate instant booking link
    const bookingLink = generateAfterHoursBookingLink(tenantId, newLead.id);

    // Send after-hours response
    const responseTime = isAfterHours ? DEFAULT_CONFIG.responseDelay * 60 * 1000 : 0;

    if (isAfterHours) {
      // Schedule immediate response
      setTimeout(async () => {
        await sendAfterHoursResponse(db, tenantId, newLead.id, bookingLink, isAfterHours);
      }, responseTime);
    } else {
      // Send immediate response
      await sendAfterHoursResponse(db, tenantId, newLead.id, bookingLink, isAfterHours);
    }

    logger.info('After-hours lead processed', {
      leadId: newLead.id,
      isAfterHours,
      responseDelay: responseTime,
      bookingLink
    });

    return {
      success: true,
      bookingLink,
      isAfterHours
    };

  } catch (error: any) {
    logger.error('Failed to process after-hours lead', { error: error.message, leadData });
    return { success: false, isAfterHours: false };
  }
}

/**
 * Send after-hours response
 */
async function sendAfterHoursResponse(
  db: Db,
  tenantId: number,
  leadId: number,
  bookingLink: string,
  isAfterHours: boolean
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

    // Generate after-hours message
    const message = await generateAfterHoursMessage(lead, bookingLink, isAfterHours);

    // Send SMS response
    await sendSMS(lead.phone, message, undefined, tenantId);

    // Log the response
    await db.insert(messages).values({
      tenantId,
      leadId,
      direction: 'outbound',
      body: message,
      status: 'sent',
      automationId: null,
      createdAt: new Date()
    });

    // Update lead status
    await db
      .update(leads)
      .set({
        status: 'contacted',
        updatedAt: new Date()
      })
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    logger.info('After-hours response sent', {
      leadId,
      isAfterHours,
      bookingLink
    });

  } catch (error: any) {
    logger.error('Failed to send after-hours response', { error: error.message, leadId });
  }
}

/**
 * Generate after-hours booking link
 */
function generateAfterHoursBookingLink(
  tenantId: number,
  leadId: number
): string {
  const token = crypto.randomBytes(32).toString('hex');
  const baseUrl = process.env.APP_URL || 'https://app.rebooked.com';
  return `${baseUrl}/after-hours-book/${token}`;
}

/**
 * Generate after-hours response message
 */
async function generateAfterHoursMessage(
  lead: any,
  bookingLink: string,
  isAfterHours: boolean
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate a friendly after-hours SMS response. The lead is ${lead.name}. The business is currently closed. Include the booking link ${bookingLink}. Create urgency for after-hours booking. Keep it under 160 characters.`
        },
        {
          role: 'user',
          content: 'Please generate an after-hours response message'
        }
      ]
    });

    return (response.choices?.[0]?.message?.content as string) ||
      `Thanks for reaching out after hours! Book instantly: ${bookingLink} We'll confirm during business hours.`;

  } catch (error: any) {
    logger.error('Failed to generate after-hours message', { error: error.message });
    return `Thanks for reaching out after hours! Book instantly: ${bookingLink} We'll confirm during business hours.`;
  }
}

/**
 * Check if current time is outside business hours
 */
function isOutsideBusinessHours(): boolean {
  const now = new Date();
  const businessHours = DEFAULT_CONFIG.businessHours;

  // Get current time in business timezone
  const localTime = new Date(now.toLocaleString("en-US", {
    timeZone: businessHours.timezone
  }));

  const currentHour = localTime.getHours();
  const currentDay = localTime.getDay();

  // Check if weekend
  const isWeekend = currentDay === 0 || currentDay === 6;

  // Check if outside business hours
  const [startHour, startMinute] = businessHours.start.split(':').map(Number);
  const [endHour, endMinute] = businessHours.end.split(':').map(Number);
  const currentTime = currentHour * 60 + localTime.getMinutes();
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  return isWeekend || currentTime < startTime || currentTime > endTime;
}

/**
 * Process after-hours queue
 */
export async function processAfterHoursQueue(
  db: Db,
  tenantId: number
): Promise<{ success: boolean; processedLeads: number; error?: string }> {
  try {
    // Get leads that were received after hours
    const afterHoursLeads = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'new'),
        eq(leads.source, 'after_hours'),
        sql`${leads.createdAt} < DATE_SUB(NOW(), INTERVAL 1 HOUR)`
      ))
      .orderBy(leads.createdAt)
      .limit(DEFAULT_CONFIG.maxQueueSize);

    let processedLeads = 0;

    for (const lead of afterHoursLeads) {
      // Generate booking link
      const bookingLink = generateAfterHoursBookingLink(tenantId, lead.id);

      // Send response
      await sendAfterHoursResponse(db, tenantId, lead.id, bookingLink, true);

      processedLeads++;
    }

    logger.info('After-hours queue processed', {
      processedLeads,
      queueSize: afterHoursLeads.length
    });

    return { success: true, processedLeads };

  } catch (error: any) {
    logger.error('Failed to process after-hours queue', { error: error.message });
    return { success: false, processedLeads: 0, error: 'Queue processing failed' };
  }
}

/**
 * Trigger after-hours automation
 */
export async function triggerAfterHoursAutomation(
  db: Db,
  tenantId: number
): Promise<void> {
  try {
    // Check if after-hours automation is enabled
    const [automation] = await db
      .select()
      .from(automations)
      .where(and(
        eq(automations.tenantId, tenantId),
        eq(automations.key, 'after_hours_response')
      ))
      .limit(1);

    if (!automation || !automation.enabled) {
      return;
    }

    // Process the queue
    await processAfterHoursQueue(db, tenantId);

    logger.info('After-hours automation triggered', { tenantId });

  } catch (error: any) {
    logger.error('Failed to trigger after-hours automation', { error: error.message, tenantId });
  }
}

/**
 * Get after-hours metrics
 */
export async function getAfterHoursMetrics(
  db: Db,
  tenantId: number,
  days: number = 30
): Promise<AfterHoursMetrics> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [metrics] = await db
    .select({
      totalLeads: sql<number>`COUNT(*)`,
      afterHoursLeads: sql<number>`COUNT(CASE WHEN ${leads.source} = 'after_hours' THEN 1 END)`,
      capturedLeads: sql<number>`COUNT(CASE WHEN ${leads.source} = 'after_hours' AND ${leads.status} = 'contacted' THEN 1 END)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      gte(leads.createdAt, startDate)
    ))
    .limit(1);

  const totalLeads = metrics?.totalLeads || 0;
  const afterHoursLeads = metrics?.afterHoursLeads || 0;
  const capturedLeads = metrics?.capturedLeads || 0;
  const captureRate = afterHoursLeads > 0 ? (capturedLeads / afterHoursLeads) * 100 : 0;
  const revenueImpact = capturedLeads * 7500; // $75 average

  return {
    totalLeads,
    afterHoursLeads,
    capturedLeads,
    captureRate,
    revenueImpact
  };
}
