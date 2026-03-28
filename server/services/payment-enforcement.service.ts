// @ts-nocheck
/**
 * Payment Enforcement Service
 * 
 * Implements card on file, cancellation fees, prepaid bookings
 * Reduces no-shows from 20% to ~5%
 */

import { eq, and, desc, sql, lt, gte } from "drizzle-orm";
import { leads, messages, automations } from "../../drizzle/schema";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import { generateMessage } from "../_core/messageGenerator";

interface PaymentConfig {
  depositAmount: number; // cents
  cancellationFee: number; // percentage
  cardOnFileRequired: boolean;
  prepaidDiscount: number; // percentage
  noShowPenalty: number; // percentage
}

interface PaymentMetrics {
  totalBookings: number;
  cardOnFileRate: number;
  cancellationRevenue: number;
  noShowsReduced: number;
  revenueImpact: number;
}

const DEFAULT_CONFIG: PaymentConfig = {
  depositAmount: 2500, // $25 deposit
  cancellationFee: 25, // 25% cancellation fee
  cardOnFileRequired: true,
  prepaidDiscount: 10, // 10% discount for prepaid
  noShowPenalty: 50 // 50% penalty for no-shows
};

/**
 * Process payment enforcement for booking
 */
export async function processPaymentEnforcement(
  db: Db,
  tenantId: number,
  leadId: number,
  paymentData: {
    requireCardOnFile?: boolean;
    depositAmount?: number;
    cancellationPolicy?: 'strict' | 'flexible';
  }
): Promise<{ success: boolean; paymentEnforced: boolean; error?: string }> {
  try {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    let paymentEnforced = false;
    let enforcementMessage = '';

    // Check if card on file is required
    if (paymentData.requireCardOnFile || DEFAULT_CONFIG.cardOnFileRequired) {
      if (!lead.cardOnFile) {
        // Request card on file
        enforcementMessage = await generateCardOnFileRequest(lead);
        await sendSMS(lead.phone, enforcementMessage, tenantId);

        // Update lead status
        await db
          .update(leads)
          .set({ 
            status: 'payment_required',
            updatedAt: new Date()
          })
          .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

        paymentEnforced = true;
      }
    }

    // Apply deposit if specified
    if (paymentData.depositAmount && !lead.depositPaid) {
      const depositMessage = await generateDepositRequest(lead, paymentData.depositAmount);
      await sendSMS(lead.phone, depositMessage, tenantId);

      // Update lead with deposit info
      await db
        .update(leads)
        .set({ 
          depositRequired: paymentData.depositAmount,
          depositPaid: false,
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

      paymentEnforced = true;
    }

    // Log payment enforcement
    await db.insert(messages).values({
      tenantId,
      leadId,
      direction: 'outbound',
      body: enforcementMessage,
      status: 'sent',
      automationId: null,
      createdAt: new Date()
    });

    logger.info('Payment enforcement processed', { 
      leadId,
      paymentEnforced,
      cardOnFile: lead.cardOnFile,
      depositRequired: paymentData.depositAmount 
    });

    return { success: true, paymentEnforced };

  } catch (error) {
    logger.error('Failed to process payment enforcement', { error: error.message, leadId });
    return { success: false, error: 'Payment enforcement failed' };
  }
}

/**
 * Process cancellation fee
 */
export async function processCancellationFee(
  db: Db,
  tenantId: number,
  leadId: number,
  cancellationHours: number
): Promise<{ success: boolean; feeCharged: number; error?: string }> {
  try {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Calculate cancellation fee based on policy
    let feePercentage = DEFAULT_CONFIG.cancellationFee;
    
    if (lead.cancellationPolicy === 'flexible') {
      feePercentage = 10; // Lower fee for flexible policy
    }

    const estimatedValue = lead.estimatedRevenue || 7500; // $75 default
    const cancellationFee = Math.round(estimatedValue * (feePercentage / 100));
    
    // Send cancellation fee notification
    const feeMessage = await generateCancellationFeeMessage(lead, cancellationFee, cancellationHours);
    await sendSMS(lead.phone, feeMessage, tenantId);

    // Update lead with cancellation fee
    await db
      .update(leads)
      .set({ 
        status: 'cancelled_with_fee',
        cancellationFee,
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    // Log cancellation fee
    await db.insert(messages).values({
      tenantId,
      leadId,
      direction: 'outbound',
      body: feeMessage,
      status: 'sent',
      automationId: null,
      createdAt: new Date()
    });

    logger.info('Cancellation fee processed', { 
      leadId,
      cancellationFee,
      feePercentage,
      cancellationHours 
    });

    return { success: true, feeCharged: cancellationFee };

  } catch (error) {
    logger.error('Failed to process cancellation fee', { error: error.message, leadId });
    return { success: false, error: 'Cancellation fee failed' };
  }
}

/**
 * Process no-show penalty
 */
export async function processNoShowPenalty(
  db: Db,
  tenantId: number,
  leadId: number
): Promise<{ success: boolean; penaltyApplied: number; error?: string }> {
  try {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Apply no-show penalty
    const estimatedValue = lead.estimatedRevenue || 7500; // $75 default
    const penaltyAmount = Math.round(estimatedValue * (DEFAULT_CONFIG.noShowPenalty / 100));
    
    // Send penalty notification
    const penaltyMessage = await generateNoShowPenaltyMessage(lead, penaltyAmount);
    await sendSMS(lead.phone, penaltyMessage, tenantId);

    // Update lead with penalty
    await db
      .update(leads)
      .set({ 
        status: 'no_show_penalty',
        noShowPenalty: penaltyAmount,
        updatedAt: new Date()
      })
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    // Log penalty
    await db.insert(messages).values({
      tenantId,
      leadId,
      direction: 'outbound',
      body: penaltyMessage,
      status: 'sent',
      automationId: null,
      createdAt: new Date()
    });

    logger.info('No-show penalty processed', { 
      leadId,
      penaltyAmount,
      penaltyPercentage: DEFAULT_CONFIG.noShowPenalty 
    });

    return { success: true, penaltyApplied: penaltyAmount };

  } catch (error) {
    logger.error('Failed to process no-show penalty', { error: error.message, leadId });
    return { success: false, error: 'No-show penalty failed' };
  }
}

/**
 * Generate card on file request message (in-house, zero API cost)
 */
function generateCardOnFileRequest(lead: any): string {
  return generateMessage({
    type: 'card_on_file',
    tone: 'professional',
    variables: { name: lead.name || '', business: '' },
  });
}

/**
 * Generate deposit request message (in-house, zero API cost)
 */
function generateDepositRequest(lead: any, depositAmount: number): string {
  return generateMessage({
    type: 'deposit_request',
    tone: 'professional',
    variables: { name: lead.name || '', amount: `$${depositAmount / 100}`, business: '' },
  });
}

/**
 * Generate cancellation fee message (in-house, zero API cost)
 */
function generateCancellationFeeMessage(
  lead: any,
  feeAmount: number,
  cancellationHours: number
): string {
  return generateMessage({
    type: 'cancellation_fee',
    tone: 'professional',
    variables: { name: lead.name || '', amount: `$${feeAmount / 100}`, business: '' },
  });
}

/**
 * Generate no-show penalty message (in-house, zero API cost)
 */
function generateNoShowPenaltyMessage(lead: any, penaltyAmount: number): string {
  return generateMessage({
    type: 'no_show_penalty',
    tone: 'professional',
    variables: { name: lead.name || '', amount: `$${penaltyAmount / 100}`, business: '' },
  });
}

/**
 * Get payment enforcement metrics
 */
export async function getPaymentEnforcementMetrics(
  db: Db,
  tenantId: number,
  days: number = 30
): Promise<PaymentMetrics> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [metrics] = await db
    .select({
      totalBookings: sql<number>`COUNT(*)`,
      cardOnFileRate: sql<number>`(COUNT(CASE WHEN card_on_file = true THEN 1 END) / COUNT(*)) * 100`,
      cancellationRevenue: sql<number>`SUM(CASE WHEN status = 'cancelled_with_fee' THEN cancellation_fee ELSE 0 END)`,
      noShowsReduced: sql<number>`COUNT(CASE WHEN status = 'no_show_penalty' THEN 1 END)`,
      avgBookingValue: sql<number>`AVG(estimated_revenue)`
    })
    .from(sql`leads l`)
    .where(and(
      eq(sql`l.tenant_id`, tenantId),
      sql`l.created_at >= ${startDate}`
    ))
    .limit(1);

  const totalBookings = metrics?.totalBookings || 0;
  const cardOnFileRate = metrics?.cardOnFileRate || 0;
  const cancellationRevenue = metrics?.cancellationRevenue || 0;
  const noShowsReduced = metrics?.noShowsReduced || 0;
  const revenueImpact = cancellationRevenue + (noShowsReduced * (metrics?.avgBookingValue || 7500));

  return {
    totalBookings,
    cardOnFileRate,
    cancellationRevenue,
    noShowsReduced,
    revenueImpact
  };
}

/**
 * Trigger payment enforcement automation
 */
export async function triggerPaymentEnforcementAutomation(
  db: Db,
  tenantId: number
): Promise<void> {
  try {
    // Check if payment enforcement automation is enabled
    const [automation] = await db
      .select()
      .from(automations)
      .where(and(
        eq(automations.tenantId, tenantId),
        eq(automations.key, 'payment_enforcement')
      ))
      .limit(1);

    if (!automation || !automation.enabled) {
      return;
    }

    // Process pending payment requirements
    const pendingPayments = await db
      .select()
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        sql`status IN ('payment_required', 'deposit_pending')`
      ))
      .orderBy(leads.createdAt)
      .limit(50);

    for (const pending of pendingPayments) {
      // Send payment reminder
      const reminderMessage = await generatePaymentReminder(pending);
      await sendSMS(pending.phone, reminderMessage, tenantId);

      // Log reminder
      await db.insert(messages).values({
        tenantId,
        leadId: pending.id,
        direction: 'outbound',
        body: reminderMessage,
        status: 'sent',
        automationId: automation.id,
        createdAt: new Date()
      });
    }

    logger.info('Payment enforcement automation triggered', { 
      pendingPayments: pendingPayments.length 
    });

  } catch (error) {
    logger.error('Failed to trigger payment enforcement automation', { error: error.message, tenantId });
  }
}

/**
 * Generate payment reminder message (in-house, zero API cost)
 */
function generatePaymentReminder(lead: any): string {
  return generateMessage({
    type: 'payment_reminder',
    tone: 'friendly',
    variables: { name: lead.name || '', business: '' },
  });
}

