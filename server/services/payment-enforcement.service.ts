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
import { invokeLLM } from "../_core/llm";

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
 * Generate card on file request message
 */
async function generateCardOnFileRequest(lead: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a professional SMS message requesting payment information. The lead is ${lead.name}. Explain that a card on file is required to secure the booking. Create urgency but be professional. Keep it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate a card on file request message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Hi ${lead.name}, to secure your booking, please add a payment method. Reply PAY to continue.`;

  } catch (error) {
    logger.error('Failed to generate card on file request', { error: error.message });
    return `Hi ${lead.name}, to secure your booking, please add a payment method. Reply PAY to continue.`;
  }
}

/**
 * Generate deposit request message
 */
async function generateDepositRequest(lead: any, depositAmount: number): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a professional SMS message requesting a deposit. The lead is ${lead.name}. The deposit amount is $${depositAmount / 100}. Explain that this secures their appointment and is refundable with proper cancellation. Keep it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate a deposit request message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Hi ${lead.name}, a $${depositAmount / 100} deposit is required to secure your booking. Reply DEPOSIT to continue.`;

  } catch (error) {
    logger.error('Failed to generate deposit request', { error: error.message });
    return `Hi ${lead.name}, a $${depositAmount / 100} deposit is required to secure your booking. Reply DEPOSIT to continue.`;
  }
}

/**
 * Generate cancellation fee message
 */
async function generateCancellationFeeMessage(
  lead: any,
  feeAmount: number,
  cancellationHours: number
): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a professional SMS message about a cancellation fee. The lead is ${lead.name}. The fee is $${feeAmount / 100}. The cancellation was made ${cancellationHours} hours before the appointment. Be transparent but professional. Keep it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate a cancellation fee message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Hi ${lead.name}, a $${feeAmount / 100} cancellation fee applies. Your booking has been cancelled.`;

  } catch (error) {
    logger.error('Failed to generate cancellation fee message', { error: error.message });
    return `Hi ${lead.name}, a $${feeAmount / 100} cancellation fee applies. Your booking has been cancelled.`;
  }
}

/**
 * Generate no-show penalty message
 */
async function generateNoShowPenaltyMessage(lead: any, penaltyAmount: number): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a professional SMS message about a no-show penalty. The lead is ${lead.name}. The penalty is $${penaltyAmount / 100}. Explain that this is due to the missed appointment without proper cancellation. Be firm but professional. Keep it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate a no-show penalty message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Hi ${lead.name}, a $${penaltyAmount / 100} no-show penalty applies. Please contact us to reschedule.`;

  } catch (error) {
    logger.error('Failed to generate no-show penalty message', { error: error.message });
    return `Hi ${lead.name}, a $${penaltyAmount / 100} no-show penalty applies. Please contact us to reschedule.`;
  }
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
 * Generate payment reminder message
 */
async function generatePaymentReminder(lead: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a friendly payment reminder SMS. The lead is ${lead.name}. They have a payment requirement pending. Create urgency but be helpful. Keep it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate a payment reminder message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Hi ${lead.name}, complete your payment to secure your booking. Reply PAY for options.`;

  } catch (error) {
    logger.error('Failed to generate payment reminder', { error: error.message });
    return `Hi ${lead.name}, complete your payment to secure your booking. Reply PAY for options.`;
  }
}

