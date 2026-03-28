/**
 * Lead Capture & Response Service
 * 
 * Implements instant lead SMS response (<60 seconds)
 * Web form auto-response with AI chat and booking links
 * Prevents missed calls and lost leads
 */

import { eq, and, desc, sql, lt, isNull } from "drizzle-orm";
import { leads, messages, automations, tenants } from "../../drizzle/schema";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import { generateMessage } from "../_core/messageGenerator";
import { encryptMessage, messageEncryption } from "../_core/message-encryption";

interface LeadCaptureConfig {
  instantResponseTime: number; // seconds
  aiChatEnabled: boolean;
  bookingLinkExpiry: number; // hours
  autoReplyTemplates: Record<string, string>;
}

const DEFAULT_CONFIG: LeadCaptureConfig = {
  instantResponseTime: 60, // 60 seconds
  aiChatEnabled: true,
  bookingLinkExpiry: 24, // 24 hours
  autoReplyTemplates: {
    newLead: "Thanks for contacting us! Click here to book: {bookingLink}\nReply STOP to unsubscribe",
    afterHours: "Thanks for reaching out! We'll respond during business hours. Book now: {bookingLink}\nReply STOP to unsubscribe",
    highVolume: "High inquiry volume - instant booking available: {bookingLink}\nReply STOP to unsubscribe"
  }
};

/**
 * Process incoming lead and send instant response
 */
export async function processIncomingLead(
  db: Db,
  tenantId: number,
  leadData: {
    name?: string;
    phone: string;
    email?: string;
    source?: string;
  }
): Promise<{ success: boolean; bookingLink?: string; responseTime?: number }> {
  const startTime = Date.now();
  
  try {
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
      await updateLeadContact(db, tenantId, existingLead.id, leadData);
      return { success: true };
    }

    // Create new lead
    const { hashPhoneNumber } = await import("../_core/phone");
    const phoneHash = hashPhoneNumber(leadData.phone);
    await db
      .insert(leads)
      .values({
        tenantId,
        name: leadData.name,
        phone: messageEncryption.isConfigured() ? messageEncryption.encryptPhoneNumber(leadData.phone) : leadData.phone,
        phoneHash,
        email: leadData.email,
        source: leadData.source || 'web_form',
        status: 'contacted',
      });

    // Get the newly created lead by phoneHash
    const [newLead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.phoneHash, phoneHash)))
      .limit(1);

    if (!newLead) {
      return { success: false };
    }

    // Generate instant booking link
    const bookingLink = await generateBookingLink(db, tenantId, newLead.id);
    
    // Send instant SMS response
    const responseTime = Date.now() - startTime;
    const isWithinInstantTime = responseTime <= DEFAULT_CONFIG.instantResponseTime * 1000;
    
    await sendInstantResponse(db, tenantId, newLead.id, bookingLink, isWithinInstantTime);
    
    // Trigger AI chat automation if enabled
    if (DEFAULT_CONFIG.aiChatEnabled) {
      await triggerAIChatAutomation(db, tenantId, newLead.id, leadData.phone);
    }

    logger.info('Lead processed with instant response', {
      leadId: newLead.id,
      responseTime: responseTime,
      isInstant: isWithinInstantTime,
      bookingLink
    });

    return {
      success: true,
      bookingLink,
      responseTime
    };

  } catch (error) {
    logger.error('Failed to process incoming lead', { error: error.message, leadData });
    return { success: false };
  }
}

/**
 * Generate secure booking link with expiry
 */
async function generateBookingLink(db: Db, tenantId: number, leadId: number): Promise<string> {
  const token = generateSecureToken();
  const expiryTime = new Date(Date.now() + DEFAULT_CONFIG.bookingLinkExpiry * 60 * 60 * 1000);
  
  // Store booking token (using raw execute since booking_tokens is not in the Drizzle schema)
  await db.execute(sql`INSERT INTO booking_tokens (tenantId, leadId, token, expiresAt, createdAt) VALUES (${tenantId}, ${leadId}, ${token}, ${expiryTime}, NOW())`);

  const baseUrl = process.env.APP_URL || 'https://app.rebooked.com';
  return `${baseUrl}/book/${token}`;
}

/**
 * Send instant SMS response based on timing and context
 */
async function sendInstantResponse(
  db: Db,
  tenantId: number,
  leadId: number,
  bookingLink: string,
  isWithinInstantTime: boolean
): Promise<void> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const businessHours = isBusinessHours(tenant?.timezone || 'America/New_York');
  
  let template = DEFAULT_CONFIG.autoReplyTemplates.newLead;
  
  if (!businessHours.isOpen) {
    template = DEFAULT_CONFIG.autoReplyTemplates.afterHours;
  } else if (!isWithinInstantTime) {
    template = DEFAULT_CONFIG.autoReplyTemplates.highVolume;
  }

  const message = template.replace('{bookingLink}', bookingLink);
  
  const leadPhone = await getLeadPhone(db, leadId);
  await sendSMS(
    leadPhone,
    message,
    undefined,
    tenantId
  );

  // Log the response
  await db.insert(messages).values({
    tenantId,
    leadId,
    direction: 'outbound',
    body: message,
    status: 'sent',
    createdAt: new Date()
  });
}

/**
 * Trigger AI chat automation for lead engagement
 */
async function triggerAIChatAutomation(
  db: Db,
  tenantId: number,
  leadId: number,
  phoneNumber: string
): Promise<void> {
  try {
    // Check if AI chat automation is enabled
    const [automation] = await db
      .select()
      .from(automations)
      .where(and(
        eq(automations.tenantId, tenantId),
        eq(automations.key, 'ai_chat_engagement')
      ))
      .limit(1);

    if (!automation || !automation.enabled) {
      return;
    }

    // Generate in-house response (zero API cost)
    const aiMessage = generateMessage({
      type: 'lead_capture',
      tone: 'friendly',
      variables: { name: '', business: '' },
    });

    // Send AI response via SMS
    await sendSMS(phoneNumber, aiMessage, undefined, tenantId);

    // Log AI interaction
    await db.insert(messages).values({
      tenantId,
      leadId,
      direction: 'outbound',
      body: aiMessage,
      status: 'sent',
      aiRewritten: true,
      automationId: automation.id,
      createdAt: new Date()
    });

    logger.info('AI chat automation triggered', { leadId, phoneNumber });

  } catch (error) {
    logger.error('Failed to trigger AI chat automation', { error: error.message, leadId });
  }
}

/**
 * Update existing lead contact information
 */
async function updateLeadContact(
  db: Db,
  tenantId: number,
  leadId: number,
  leadData: { name?: string; email?: string; phone?: string }
): Promise<void> {
  await db
    .update(leads)
    .set({
      name: leadData.name,
      email: leadData.email,
      phone: messageEncryption.isConfigured() ? messageEncryption.encryptPhoneNumber(leadData.phone!) : leadData.phone,
      updatedAt: new Date()
    })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
}

/**
 * Check if current time is within business hours
 */
function isBusinessHours(timezone: string): { isOpen: boolean; nextOpen?: Date } {
  const now = new Date();
  const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  
  const hour = localTime.getHours();
  const dayOfWeek = localTime.getDay();
  
  // Business hours: Mon-Fri, 8AM-6PM
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isBusinessHours = isWeekday && hour >= 8 && hour < 18;
  
  if (isBusinessHours) {
    return { isOpen: true };
  }
  
  // Calculate next opening time
  let nextOpen = new Date(localTime);
  if (!isWeekday) {
    // Next Monday
    const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
    nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
    nextOpen.setHours(8, 0, 0, 0);
  } else {
    // Next day at 8AM
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(8, 0, 0, 0);
  }
  
  return { isOpen: false, nextOpen };
}

/**
 * Get lead phone number for SMS
 */
async function getLeadPhone(db: Db, leadId: number): Promise<string> {
  const [lead] = await db
    .select({ phone: leads.phone })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead || !lead.phone) {
    throw new Error('Lead phone not found');
  }

  // Decrypt if encrypted
  if (messageEncryption.isConfigured()) {
    try {
      return messageEncryption.decryptPhoneNumber(lead.phone);
    } catch {
      return lead.phone; // Fallback to encrypted if decryption fails
    }
  }

  return lead.phone;
}

/**
 * Generate secure token for booking links
 */
function generateSecureToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate lead capture metrics
 */
export async function getLeadCaptureMetrics(
  db: Db,
  tenantId: number,
  days: number = 30
): Promise<{
    totalLeads: number;
    instantResponses: number;
    averageResponseTime: number;
    conversionRate: number;
    revenueImpact: number;
  }> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const metrics = await db.execute(sql`
    SELECT
      COUNT(*) as totalLeads,
      COUNT(CASE WHEN response_time <= ${DEFAULT_CONFIG.instantResponseTime * 1000} THEN 1 END) as instantResponses,
      AVG(response_time) as avgResponseTime,
      COUNT(CASE WHEN status = 'booked' THEN 1 END) as conversions
    FROM (
      SELECT
        l.*,
        TIMESTAMPDIFF(SECOND, l.created_at, MIN(m.created_at)) as response_time
      FROM leads l
      LEFT JOIN messages m ON l.id = m.lead_id
      WHERE l.tenant_id = ${tenantId}
        AND l.created_at >= ${startDate}
      GROUP BY l.id
    ) sub
  `) as any;
  const row = Array.isArray(metrics) && metrics.length > 0 ? (Array.isArray(metrics[0]) ? metrics[0][0] : metrics[0]) : {} as any;

  const totalLeads = Number(row?.totalLeads) || 0;
  const instantResponses = Number(row?.instantResponses) || 0;
  const averageResponseTime = Number(row?.avgResponseTime) || 0;
  const conversions = Number(row?.conversions) || 0;
  const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;
  
  // Calculate revenue impact (assuming $75 avg appointment value)
  const revenueImpact = conversions * 7500; // $75 in cents

  return {
    totalLeads,
    instantResponses,
    averageResponseTime,
    conversionRate,
    revenueImpact
  };
}
