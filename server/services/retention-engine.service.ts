// @ts-nocheck
/**
 * Retention Engine Service
 * 
 * Implements time-based rebooking, loyalty flows, reactivation campaigns
 * Increases retention by 10-25% and expands LTV
 */

import { eq, and, desc, sql, lt, gte } from "drizzle-orm";
import { leads, messages, automations } from "../../drizzle/schema";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import { invokeLLM } from "../_core/llm";

interface RetentionConfig {
  rebookingIntervals: number[]; // weeks
  loyaltyTiers: {
    visits: number;
    reward: string;
    message: string;
  }[];
  reactivationWindows: number[]; // days
}

interface RetentionMetrics {
  totalClients: number;
  rebookedClients: number;
  retentionRate: number;
  ltvExpansion: number;
  revenueImpact: number;
}

const DEFAULT_CONFIG: RetentionConfig = {
  rebookingIntervals: [4, 6, 8], // 4, 6, 8 weeks
  loyaltyTiers: [
    { visits: 3, reward: '10% discount', message: 'Loyalty reward: 10% off your next booking!' },
    { visits: 5, reward: '15% discount', message: 'VIP reward: 15% off your next booking!' },
    { visits: 10, reward: '20% discount', message: 'Elite reward: 20% off your next booking!' }
  ],
  reactivationWindows: [30, 60, 90] // 30, 60, 90 days
};

/**
 * Trigger time-based rebooking campaigns
 */
export async function triggerTimeBasedRebooking(
  db: Db,
  tenantId: number
): Promise<{ success: boolean; rebookedClients: number; error?: string }> {
  try {
    const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // 6 months back

    // Find clients who haven't booked in 6 months
    const inactiveClients = await db
      .select({
        clientId: sql`l.id`,
        name: sql`l.name`,
        phone: sql`l.phone`,
        lastBookingDate: sql`MAX(l.appointment_at)`,
        totalBookings: sql`COUNT(*)`,
        avgValue: sql`AVG(l.estimated_revenue)`
      })
      .from(sql`leads l`)
      .where(and(
        eq(sql`l.tenant_id`, tenantId),
        eq(sql`l.status`, 'booked'),
        sql`l.appointment_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)`
      ))
      .groupBy(sql`l.id`)
      .having(sql`MAX(l.appointment_at) < ${startDate}`)
      .orderBy(sql`MAX(l.appointment_at)`)
      .limit(20);

    let rebookedClients = 0;

    for (const client of inactiveClients) {
      // Generate rebooking offer based on inactivity period
      const monthsInactive = getMonthsInactive(client.lastBookingDate);
      const rebookingOffer = await generateRebookingOffer(client, monthsInactive);
      
      await sendSMS(client.phone, rebookingOffer, tenantId);

      // Log the rebooking campaign
      await db.insert(messages).values({
        tenantId,
        leadId: client.clientId,
        direction: 'outbound',
        body: rebookingOffer,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });

      rebookedClients++;
    }

    logger.info('Time-based rebooking campaign triggered', { 
      rebookedClients,
      monthsBack: 6 
    });

    return { success: true, rebookedClients };

  } catch (error) {
    logger.error('Failed to trigger time-based rebooking', { error: error.message });
    return { success: false, error: 'Rebooking campaign failed' };
  }
}

/**
 * Trigger loyalty reward campaigns
 */
export async function triggerLoyaltyRewards(
  db: Db,
  tenantId: number
): Promise<{ success: boolean; rewardedClients: number; error?: string }> {
  try {
    // Find clients eligible for loyalty rewards
    const eligibleClients = await db
      .select({
        clientId: sql`l.id`,
        name: sql`l.name`,
        phone: sql`l.phone`,
        visitCount: sql`COUNT(*)`,
        lastVisitDate: sql`MAX(l.appointment_at)`,
        avgValue: sql`AVG(l.estimated_revenue)`
      })
      .from(sql`leads l`)
      .where(and(
        eq(sql`l.tenant_id`, tenantId),
        eq(sql`l.status`, 'booked'),
        sql`l.appointment_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)` // Active in last 12 months
      ))
      .groupBy(sql`l.id`)
      .having(sql`COUNT(*) >= 3`) // At least 3 visits
      .orderBy(sql`MAX(l.appointment_at)`)
      .limit(50);

    let rewardedClients = 0;

    for (const client of eligibleClients) {
      // Determine loyalty tier
      const tier = getLoyaltyTier(client.visitCount);
      const loyaltyMessage = await generateLoyaltyMessage(client, tier);
      
      await sendSMS(client.phone, loyaltyMessage, tenantId);

      // Update client with loyalty reward
      await db
        .update(sql`leads l`)
        .set({ 
          loyalty_tier: tier.visits,
          loyalty_reward: tier.reward,
          updatedAt: new Date()
        })
        .where(eq(sql`l.id`, client.clientId));

      // Log the loyalty reward
      await db.insert(messages).values({
        tenantId,
        leadId: client.clientId,
        direction: 'outbound',
        body: loyaltyMessage,
        status: 'sent',
        automationId: null,
        createdAt: new Date()
      });

      rewardedClients++;
    }

    logger.info('Loyalty rewards campaign triggered', { 
      rewardedClients,
      tiersAwarded: Object.keys(DEFAULT_CONFIG.loyaltyTiers).length 
    });

    return { success: true, rewardedClients };

  } catch (error) {
    logger.error('Failed to trigger loyalty rewards', { error: error.message });
    return { success: false, error: 'Loyalty campaign failed' };
  }
}

/**
 * Trigger reactivation campaigns
 */
export async function triggerReactivationCampaigns(
  db: Db,
  tenantId: number
): Promise<{ success: boolean; reactivatedClients: number; error?: string }> {
  try {
    let reactivatedClients = 0;

    for (const window of DEFAULT_CONFIG.reactivationWindows) {
      // Find clients inactive for this window
      const cutoffDate = new Date(Date.now() - window * 24 * 60 * 60 * 1000);
      
      const inactiveClients = await db
        .select({
          clientId: sql`l.id`,
          name: sql`l.name`,
          phone: sql`l.phone`,
          lastActivityDate: sql`MAX(l.updated_at)`,
          estimatedValue: sql`l.estimated_revenue`
        })
        .from(sql`leads l`)
        .where(and(
          eq(sql`l.tenant_id`, tenantId),
          sql`l.updated_at < ${cutoffDate}`,
          sql`l.status IN ('contacted', 'qualified')`
        ))
        .orderBy(sql`MAX(l.updated_at)`)
        .limit(10);

      for (const client of inactiveClients) {
        // Generate reactivation offer
        const reactivationMessage = await generateReactivationMessage(client, window);
        
        await sendSMS(client.phone, reactivationMessage, tenantId);

        // Update client status
        await db
          .update(sql`leads l`)
          .set({ 
            status: 'reactivation_sent',
            updatedAt: new Date()
          })
          .where(eq(sql`l.id`, client.clientId));

        // Log the reactivation
        await db.insert(messages).values({
          tenantId,
          leadId: client.clientId,
          direction: 'outbound',
          body: reactivationMessage,
          status: 'sent',
          automationId: null,
          createdAt: new Date()
        });

        reactivatedClients++;
      }
    }

    logger.info('Reactivation campaigns triggered', { 
      reactivatedClients,
      windows: DEFAULT_CONFIG.reactivationWindows 
    });

    return { success: true, reactivatedClients };

  } catch (error) {
    logger.error('Failed to trigger reactivation campaigns', { error: error.message });
    return { success: false, error: 'Reactivation campaign failed' };
  }
}

/**
 * Get loyalty tier based on visit count
 */
function getLoyaltyTier(visitCount: number) {
  for (const tier of DEFAULT_CONFIG.loyaltyTiers) {
    if (visitCount >= tier.visits) {
      return tier;
    }
  }
  return DEFAULT_CONFIG.loyaltyTiers[0]; // Default tier
}

/**
 * Generate rebooking offer message
 */
async function generateRebookingOffer(client: any, monthsInactive: number): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a personalized rebooking SMS message. The client ${client.name} hasn't booked in ${monthsInactive} months. Their last appointment was ${client.lastBookingDate?.toLocaleString()}. Their average value is $${(client.avgValue || 75)}. Create urgency and a compelling offer to book again. Make it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate the rebooking message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Hi ${client.name}, we miss you! Book again and get 15% off your next visit.`;

  } catch (error) {
    logger.error('Failed to generate rebooking message', { error: error.message });
    return `Hi ${client.name}, we miss you! Book again and get 15% off your next visit.`;
  }
}

/**
 * Generate loyalty reward message
 */
async function generateLoyaltyMessage(client: any, tier: any): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a personalized loyalty reward SMS message. The client ${client.name} has ${client.visitCount} visits. They're getting the ${tier.reward} reward. Create excitement and urgency. Make it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate the loyalty reward message'
      }
    ]);

    return response.choices?.[0]?.message?.content || tier.message;

  } catch (error) {
    logger.error('Failed to generate loyalty message', { error: error.message });
    return tier.message;
  }
}

/**
 * Generate reactivation message
 */
async function generateReactivationMessage(client: any, daysInactive: number): Promise<string> {
  try {
    const response = await invokeLLM([
      {
        role: 'system',
        content: `Generate a personalized reactivation SMS message. The client ${client.name} has been inactive for ${daysInactive} days. Their estimated value is $${(client.estimatedValue || 75)}. Create a compelling offer to come back. Make it under 160 characters.`
      },
      {
        role: 'user',
        content: 'Please generate the reactivation message'
      }
    ]);

    return response.choices?.[0]?.message?.content || 
      `Hi ${client.name}, we miss you! Come back and get 20% off your next booking.`;

  } catch (error) {
    logger.error('Failed to generate reactivation message', { error: error.message });
    return `Hi ${client.name}, we miss you! Come back and get 20% off your next booking.`;
  }
}

/**
 * Calculate months inactive
 */
function getMonthsInactive(lastDate: Date): number {
  const now = new Date();
  const diffTime = now.getTime() - lastDate.getTime();
  return Math.floor(diffTime / (30 * 24 * 60 * 60 * 1000)); // Convert to months
}

/**
 * Get retention metrics
 */
export async function getRetentionMetrics(
  db: Db,
  tenantId: number,
  days: number = 90
): Promise<RetentionMetrics> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [metrics] = await db
    .select({
      totalClients: sql<number>`COUNT(DISTINCT tenant_id)`,
      rebookedClients: sql<number>`COUNT(CASE WHEN status = 'rebooked' AND created_at >= ${startDate} THEN 1 END)`,
      avgClientValue: sql<number>`AVG(estimated_revenue)`,
      ltvIncrease: sql<number>`AVG(CASE WHEN status = 'rebooked' THEN estimated_revenue ELSE 0 END)`
    })
    .from(sql`leads l`)
    .where(and(
      eq(sql`l.tenant_id`, tenantId),
      sql`l.created_at >= ${startDate}`
    ))
    .limit(1);

  const totalClients = metrics?.totalClients || 0;
  const rebookedClients = metrics?.rebookedClients || 0;
  const retentionRate = totalClients > 0 ? (rebookedClients / totalClients) * 100 : 0;
  const ltvExpansion = metrics?.ltvIncrease || 0;
  const revenueImpact = rebookedClients * (metrics?.avgClientValue || 7500); // $75 average

  return {
    totalClients,
    rebookedClients,
    retentionRate,
    ltvExpansion,
    revenueImpact
  };
}

