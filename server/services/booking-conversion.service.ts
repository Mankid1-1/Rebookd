/**
 * Booking Conversion Optimization Service
 * 
 * Implements one-click booking links, mobile-first flow, SMS booking
 * Prevents lead drop-off before booking
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { leads, messages, automations } from "../../drizzle/schema";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import { generateSecureToken } from "../_core/message-encryption";

interface BookingLink {
  token: string;
  url: string;
  expiresAt: Date;
  leadId: number;
}

interface ConversionMetrics {
  totalLeads: number;
  bookingsGenerated: number;
  conversionRate: number;
  revenueImpact: number;
}

const BOOKING_LINK_EXPIRY_HOURS = 24;
const MOBILE_FIRST_THRESHOLD = 0.7; // 70% mobile traffic

/**
 * Generate one-click booking link
 */
export async function generateBookingLink(
  db: Db,
  tenantId: number,
  leadId: number,
  options: {
    serviceType?: string;
    preferredTime?: Date;
    customMessage?: string;
  } = {}
): Promise<BookingLink> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + BOOKING_LINK_EXPIRY_HOURS * 60 * 60 * 1000);
  
  // Store booking link
  await db
    .insert(sql`INSERT INTO booking_links (tenant_id, lead_id, token, expires_at, service_type, preferred_time, custom_message, created_at) VALUES (${tenantId}, ${leadId}, ${token}, ${expiresAt}, ${options.serviceType || 'general'}, ${options.preferredTime || null}, ${options.customMessage || null}, NOW())`)
    .run();

  const baseUrl = process.env.APP_URL || 'https://app.rebooked.com';
  const bookingUrl = `${baseUrl}/book/${token}`;
  
  return {
    token,
    url: bookingUrl,
    expiresAt,
    leadId
  };
}

/**
 * Process booking link click
 */
export async function processBookingLink(
  db: Db,
  token: string,
  deviceInfo?: { isMobile: boolean; userAgent?: string }
): Promise<{ success: boolean; bookingUrl?: string; error?: string }> {
  try {
    // Validate token and get booking details
    const [bookingLink] = await db
      .select()
      .from(sql`booking_links`)
      .where(and(
        sql`token = ${token}`,
        sql`expires_at > NOW()`
      ))
      .limit(1);

    if (!bookingLink) {
      return { success: false, error: 'Invalid or expired booking link' };
    }

    // Update lead status to indicate booking intent
    await db
      .update(leads)
      .set({ 
        status: 'booking_intent',
        updatedAt: new Date()
      })
      .where(and(
        eq(leads.id, bookingLink.lead_id),
        eq(leads.tenantId, bookingLink.tenant_id)
      ));

    // Generate mobile-optimized booking page
    const bookingPage = await generateMobileOptimizedBookingPage(
      db,
      bookingLink.lead_id,
      deviceInfo?.isMobile || false
    );

    // Track conversion event
    await trackBookingLinkClick(db, bookingLink.lead_id, deviceInfo);

    return {
      success: true,
      bookingUrl: bookingPage
    };

  } catch (error) {
    logger.error('Failed to process booking link', { error: error.message, token });
    return { success: false, error: 'Booking processing failed' };
  }
}

/**
 * Generate mobile-optimized booking page
 */
async function generateMobileOptimizedBookingPage(
  db: Db,
  leadId: number,
  isMobile: boolean
): Promise<string> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) {
    throw new Error('Lead not found');
  }

  const baseUrl = process.env.APP_URL || 'https://app.rebooked.com';
  
  if (isMobile) {
    // Mobile-first booking flow
    return `${baseUrl}/mobile-book/${lead.id}?utm_source=sms&utm_medium=mobile`;
  } else {
    // Desktop booking flow
    return `${baseUrl}/book/${lead.id}?utm_source=sms&utm_medium=web`;
  }
}

/**
 * Send SMS booking link
 */
export async function sendSMSBookingLink(
  db: Db,
  tenantId: number,
  leadId: number,
  options: {
    message?: string;
    urgency?: 'normal' | 'urgent';
  } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Generate booking link
    const bookingLink = await generateBookingLink(db, tenantId, leadId, {
      serviceType: 'sms_booking',
      preferredTime: null
    });

    // Craft message based on urgency
    let message = options.message || 
      `Book your appointment instantly: ${bookingLink.url}\nReply STOP to unsubscribe`;
    
    if (options.urgency === 'urgent') {
      message = `URGENT: ${message}`;
    }

    // Send SMS
    await sendSMS(lead.phone, message, tenantId);

    // Log the SMS
    await db.insert(messages).values({
      tenantId,
      leadId,
      direction: 'outbound',
      body: message,
      status: 'sent',
      automationId: null,
      createdAt: new Date()
    });

    logger.info('SMS booking link sent', { 
      leadId, 
      bookingLink: bookingLink.url,
      isUrgent: options.urgency === 'urgent'
    });

    return { success: true };

  } catch (error) {
    logger.error('Failed to send SMS booking link', { error: error.message, leadId });
    return { success: false, error: 'SMS sending failed' };
  }
}

/**
 * Track booking link click and conversion
 */
async function trackBookingLinkClick(
  db: Db,
  leadId: number,
  deviceInfo?: { isMobile: boolean; userAgent?: string }
): Promise<void> {
  await db
    .insert(sql`INSERT INTO booking_analytics (lead_id, is_mobile, user_agent, clicked_at) VALUES (${leadId}, ${deviceInfo?.isMobile || false}, ${deviceInfo?.userAgent || null}, NOW())`)
    .run();
}

/**
 * Get booking conversion metrics
 */
export async function getBookingConversionMetrics(
  db: Db,
  tenantId: number,
  days: number = 30
): Promise<ConversionMetrics> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [metrics] = await db
    .select({
      totalLeads: sql<number>`COUNT(*)`,
      bookingsGenerated: sql<number>`COUNT(CASE WHEN l.status = 'booking_intent' THEN 1 END)`,
      conversions: sql<number>`COUNT(CASE WHEN l.status = 'booked' THEN 1 END)`,
      avgLeadValue: sql<number>`AVG(l.estimated_revenue)`
    })
    .from(sql`leads l`)
    .where(and(
      eq(sql`l.tenant_id`, tenantId),
      sql`l.created_at >= ${startDate}`
    ))
    .limit(1);

  const totalLeads = metrics?.totalLeads || 0;
  const bookingsGenerated = metrics?.bookingsGenerated || 0;
  const conversions = metrics?.conversions || 0;
  const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;
  const revenueImpact = conversions * (metrics?.avgLeadValue || 7500); // $75 average

  return {
    totalLeads,
    bookingsGenerated,
    conversionRate,
    revenueImpact
  };
}

/**
 * Trigger booking conversion automation
 */
export async function triggerBookingConversionAutomation(
  db: Db,
  tenantId: number,
  leadId: number
): Promise<void> {
  try {
    // Check if booking conversion automation exists
    const [automation] = await db
      .select()
      .from(automations)
      .where(and(
        eq(automations.tenantId, tenantId),
        eq(automations.key, 'booking_conversion')
      ))
      .limit(1);

    if (!automation || !automation.enabled) {
      return;
    }

    // Create booking link and send SMS
    const bookingLink = await generateBookingLink(db, tenantId, leadId);
    await sendSMSBookingLink(db, tenantId, leadId, {
      urgency: 'normal'
    });

    logger.info('Booking conversion automation triggered', { 
      leadId, 
      bookingLink: bookingLink.url 
    });

  } catch (error) {
    logger.error('Failed to trigger booking conversion automation', { error: error.message, leadId });
  }
}

/**
 * Optimize booking page for mobile devices
 */
export async function optimizeBookingPageForMobile(
  db: Db,
  tenantId: number
): Promise<{ recommendations: string[]; mobileOptimization: number }> {
  const [metrics] = await db
    .select({
      mobileClicks: sql<number>`COUNT(CASE WHEN is_mobile = true THEN 1 END)`,
      totalClicks: sql<number>`COUNT(*)`,
      mobileConversions: sql<number>`COUNT(CASE WHEN is_mobile = true AND status = 'booked' THEN 1 END)`
    })
    .from(sql`booking_analytics ba`)
    .where(and(
      eq(sql`ba.tenant_id`, tenantId),
      sql`ba.clicked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    ))
    .limit(1);

  const totalClicks = metrics?.totalClicks || 0;
  const mobileClicks = metrics?.mobileClicks || 0;
  const mobileConversions = metrics?.mobileConversions || 0;
  const mobileConversionRate = mobileClicks > 0 ? (mobileConversions / mobileClicks) * 100 : 0;
  const mobileOptimization = totalClicks > 0 ? (mobileClicks / totalClicks) * 100 : 0;

  const recommendations: string[] = [];

  if (mobileOptimization < MOBILE_FIRST_THRESHOLD) {
    recommendations.push('Increase mobile optimization - below 70% threshold');
    recommendations.push('Add mobile-specific booking flow');
    recommendations.push('Optimize SMS templates for mobile');
  }

  if (mobileConversionRate < 15) {
    recommendations.push('Improve mobile booking conversion rate');
    recommendations.push('Add one-tap booking for mobile');
  }

  return {
    recommendations,
    mobileOptimization
  };
}
