import { and, desc, eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import { billingInvoices, billingRefunds, subscriptions, plans, leads, usage, tenants, recoveryEvents } from "../../drizzle/schema";
import type { Db } from "../_core/context";

// ─── Revenue Share Constants ─────────────────────────────────────────────────
// Defaults — overridden per-tenant by subscription/plan settings
const DEFAULT_REVENUE_SHARE_PERCENT = 15;
const DEFAULT_MONTHLY_FEE_CENTS = 19900; // $199 in cents
const EARLY_ADOPTER_SLOTS = 20;
const DEFAULT_AVG_APPOINTMENT_VALUE = 150; // $150 default

// FIX #21: Soft launch mode now driven by env var (admin-toggleable)
const SOFT_LAUNCH_MODE = process.env.ROI_SOFT_LAUNCH !== "false"; // defaults to true
// ROI must exceed this threshold before billing kicks in (10% safety margin)
const ROI_SAFETY_MARGIN_PERCENT = 10;
// FIX #20: ROI guarantee expires after this many days
const ROI_GUARANTEE_DAYS = parseInt(process.env.ROI_GUARANTEE_DAYS || "35", 10);

// Use centralized Stripe singleton from _core/stripe.ts
import { stripe } from "../_core/stripe";

export async function listInvoicesByTenant(db: Db, tenantId: number) {
  return db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.tenantId, tenantId))
    .orderBy(desc(billingInvoices.createdAt));
}

export async function listRefundsByTenant(db: Db, tenantId: number) {
  return db
    .select()
    .from(billingRefunds)
    .where(eq(billingRefunds.tenantId, tenantId))
    .orderBy(desc(billingRefunds.createdAt));
}

export async function upsertInvoiceFromStripeEvent(db: Db, input: {
  tenantId: number;
  subscriptionId?: number;
  invoice: Stripe.Invoice;
}) {
  const payload = {
    tenantId: input.tenantId,
    subscriptionId: input.subscriptionId,
    stripeInvoiceId: input.invoice.id,
    stripeChargeId: typeof input.invoice.charge === "string" ? input.invoice.charge : undefined,
    number: input.invoice.number ?? undefined,
    status: input.invoice.status ?? "draft",
    currency: input.invoice.currency,
    subtotal: input.invoice.subtotal ?? 0,
    total: input.invoice.total ?? 0,
    amountPaid: input.invoice.amount_paid ?? 0,
    amountRemaining: input.invoice.amount_remaining ?? 0,
    hostedInvoiceUrl: input.invoice.hosted_invoice_url ?? undefined,
    invoicePdfUrl: input.invoice.invoice_pdf ?? undefined,
    periodStart: (input.invoice as any).period_start ? new Date((input.invoice as any).period_start * 1000) : undefined,
    periodEnd: (input.invoice as any).period_end ? new Date((input.invoice as any).period_end * 1000) : undefined,
    updatedAt: new Date(),
  };
  const [existing] = await db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.stripeInvoiceId, input.invoice.id))
    .limit(1);
  if (existing) {
    await db.update(billingInvoices).set(payload).where(eq(billingInvoices.id, existing.id));
    return existing.id;
  }
  const result = await db.insert(billingInvoices).values(payload);
  return Number((result as any).insertId ?? 0);
}

export async function createRefundRecord(db: Db, input: {
  tenantId: number;
  subscriptionId?: number;
  billingInvoiceId?: number;
  refund: Stripe.Refund;
}) {
  const [existing] = await db
    .select()
    .from(billingRefunds)
    .where(eq(billingRefunds.stripeRefundId, input.refund.id))
    .limit(1);
  const payload = {
    tenantId: input.tenantId,
    subscriptionId: input.subscriptionId,
    billingInvoiceId: input.billingInvoiceId,
    stripeRefundId: input.refund.id,
    stripeChargeId: typeof input.refund.charge === "string" ? input.refund.charge : undefined,
    amount: input.refund.amount,
    currency: input.refund.currency,
    reason: input.refund.reason ?? undefined,
    status: input.refund.status ?? "pending",
  };
  if (existing) {
    await db.update(billingRefunds).set(payload).where(eq(billingRefunds.id, existing.id));
    return existing.id;
  }
  const result = await db.insert(billingRefunds).values(payload);
  return Number((result as any).insertId ?? 0);
}

export async function getSubscriptionRowByTenant(db: Db, tenantId: number) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return row;
}

export async function changeSubscriptionPlan(
  db: Db,
  input: {
    tenantId: number;
    priceId: string;
    prorateImmediately?: boolean;
  },
) {
  const subscription = await getSubscriptionRowByTenant(db, input.tenantId);
  if (!subscription?.stripeId) {
    throw new Error("No active Stripe subscription found");
  }
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeId);
  const itemId = stripeSubscription.items.data[0]?.id;
  if (!itemId) throw new Error("Stripe subscription item missing");

  return stripe.subscriptions.update(subscription.stripeId, {
    items: [{ id: itemId, price: input.priceId }],
    cancel_at_period_end: false,
    proration_behavior: input.prorateImmediately ? "always_invoice" : "create_prorations",
  });
}

export async function issueRefundForInvoiceCharge(
  db: Db,
  input: {
    tenantId: number;
    stripeInvoiceId: string;
    amount?: number;
    reason?: Stripe.RefundCreateParams.Reason;
  },
) {
  const [invoice] = await db
    .select()
    .from(billingInvoices)
    .where(and(eq(billingInvoices.tenantId, input.tenantId), eq(billingInvoices.stripeInvoiceId, input.stripeInvoiceId)))
    .limit(1);
  if (!invoice?.stripeChargeId) {
    throw new Error("Invoice charge not found");
  }
  const refund = await stripe.refunds.create({
    charge: invoice.stripeChargeId,
    amount: input.amount,
    reason: input.reason,
  });
  await createRefundRecord(db, {
    tenantId: input.tenantId,
    subscriptionId: invoice.subscriptionId ?? undefined,
    billingInvoiceId: invoice.id,
    refund,
  });
  return refund;
}

// ─── Revenue Share Calculation ───────────────────────────────────────────────

export async function calculateRevenueShare(db: Db, tenantId: number) {
  // Get the tenant's subscription to check for custom monthly price (Flex plan)
  const sub = await getSubscriptionRowByTenant(db, tenantId);

  // Flex plan stores customMonthlyPrice in cents; fall back to default $199
  const monthlyFeeCents = sub?.customMonthlyPrice ?? DEFAULT_MONTHLY_FEE_CENTS;

  // Get revenue share % from the plan (Rebooked = 10%, Flex = 15%)
  let revenueSharePercent = DEFAULT_REVENUE_SHARE_PERCENT;
  if (sub?.planId) {
    const [plan] = await db.select({ revenueSharePercent: plans.revenueSharePercent }).from(plans).where(eq(plans.id, sub.planId)).limit(1);
    if (plan && plan.revenueSharePercent > 0) {
      revenueSharePercent = plan.revenueSharePercent;
    }
  }

  // Check tenant settings and billingType for per-tenant overrides
  const [tenant] = await db
    .select({ settings: tenants.settings, currency: tenants.currency, billingType: tenants.billingType })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const avgAppointmentValue =
    (tenant?.settings as any)?.avgAppointmentValue ?? DEFAULT_AVG_APPOINTMENT_VALUE;
  const currency = tenant?.currency ?? "usd";
  const billingType = tenant?.billingType ?? "standard";

  // Founder clients get $0 base fee (free-forever tier, 20 spots)
  const effectiveMonthlyFeeCents = billingType === "founder" ? 0 : monthlyFeeCents;

  // FIX #14: Prefer REALIZED revenue from recovery events (confirmed payments)
  // over simple booked lead counts.
  let realizedRevenueCents = 0;
  let realizedCount = 0;
  try {
    const [realizedRow] = await db
      .select({
        totalRealized: sql<number>`COALESCE(SUM(${recoveryEvents.realizedRevenue}), 0)`,
        realizedCount: sql<number>`COUNT(*)`,
      })
      .from(recoveryEvents)
      .where(
        and(
          eq(recoveryEvents.tenantId, tenantId),
          eq(recoveryEvents.isPrimaryAttribution, true),
          sql`${recoveryEvents.status} IN ('realized', 'manual_realized')`,
        )
      );
    realizedRevenueCents = Number(realizedRow?.totalRealized ?? 0);
    realizedCount = Number(realizedRow?.realizedCount ?? 0);
  } catch {
    // Fallback: recovery_events table may not exist yet
  }

  // Also count booked leads for estimated metrics
  const [bookedRows] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "booked"))),
  ]);
  const bookedCount = Number(bookedRows[0]?.c ?? 0);
  const recoveredAppointments = realizedCount > 0 ? realizedCount : bookedCount;
  // Bill on realized revenue when available; fall back to estimated (booked × avgValue)
  const recoveredRevenue = realizedRevenueCents > 0
    ? realizedRevenueCents / 100
    : bookedCount * avgAppointmentValue;
  const revenueShareOwed = Math.round(recoveredRevenue * (revenueSharePercent / 100) * 100) / 100;
  const monthlyFee = effectiveMonthlyFeeCents / 100;

  return {
    recoveredAppointments,
    recoveredRevenue,
    avgAppointmentValue,
    revenueSharePercent,
    revenueShareOwed,
    monthlyFee,
    billingType,
    totalCost: monthlyFee + revenueShareOwed,
    netSavings: recoveredRevenue - (monthlyFee + revenueShareOwed),
    currency,
  };
}

// ─── ROI Guarantee ───────────────────────────────────────────────────────────

export async function checkRoiGuarantee(db: Db, tenantId: number) {
  // Check if this tenant is a founder / promotional subscriber
  const sub = await getSubscriptionRowByTenant(db, tenantId);
  const isPromotional = sub?.isPromotional ?? false;

  // Get the plan's promotional slots (Flex = 10, Rebooked = 20)
  let planPromoSlots = EARLY_ADOPTER_SLOTS;
  if (sub?.planId) {
    const [plan] = await db.select({ promotionalSlots: plans.promotionalSlots }).from(plans).where(eq(plans.id, sub.planId)).limit(1);
    if (plan) planPromoSlots = plan.promotionalSlots;
  }

  // Count total promotional subscriptions
  const [promoCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(subscriptions)
    .where(eq(subscriptions.isPromotional, true));
  const earlyAdopterCount = Number(promoCount[0]?.c ?? 0);
  const slotsRemaining = Math.max(0, planPromoSlots - earlyAdopterCount);

  // Calculate ROI (includes billingType-aware fee calculation)
  const share = await calculateRevenueShare(db, tenantId);
  const roiPercent = share.totalCost > 0 ? Math.round((share.netSavings / share.totalCost) * 100) : 0;

  // FIX #20: Check if the guarantee period has expired (35 days from subscription start)
  const subscriptionStartDate = sub?.currentPeriodStart ?? sub?.createdAt;
  const daysSinceSubscriptionStart = subscriptionStartDate
    ? (Date.now() - new Date(subscriptionStartDate).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const guaranteePeriodExpired = daysSinceSubscriptionStart > ROI_GUARANTEE_DAYS;

  // Founder clients always get the guarantee (free-forever tier)
  // During soft launch, ALL clients get ROI guarantee
  // Guarantee stays active until ROI exceeds the safety margin (10%) OR period expires
  const isFounder = share.billingType === "founder";
  const hasPositiveRoi = roiPercent > ROI_SAFETY_MARGIN_PERCENT;

  let guaranteeActive: boolean;
  if (isFounder) {
    // Founders: guarantee until ROI positive (no time limit — free-forever tier)
    guaranteeActive = !hasPositiveRoi;
  } else if (guaranteePeriodExpired) {
    // FIX #20: Non-founders lose guarantee after 35 days regardless of ROI
    guaranteeActive = false;
  } else if (SOFT_LAUNCH_MODE) {
    // Soft launch: every client gets guarantee (within 35-day window)
    guaranteeActive = !hasPositiveRoi;
  } else {
    // Post-launch: only early adopters get guarantee (within 35-day window)
    guaranteeActive = isPromotional && !hasPositiveRoi;
  }

  return {
    isEarlyAdopter: isPromotional,
    isFounder,
    earlyAdopterCount,
    slotsRemaining,
    softLaunchMode: SOFT_LAUNCH_MODE,
    hasPositiveRoi,
    roiPercent,
    guaranteeActive,
    guaranteePeriodExpired,
    daysSinceSubscriptionStart: Math.floor(daysSinceSubscriptionStart),
    guaranteeDaysRemaining: Math.max(0, ROI_GUARANTEE_DAYS - Math.floor(daysSinceSubscriptionStart)),
    ...share,
  };
}

// ─── Create Revenue Share Invoice ────────────────────────────────────────────

export async function createRevenueShareInvoice(tenantId: number, db: Db) {
  const sub = await getSubscriptionRowByTenant(db, tenantId);
  if (!sub?.stripeId) return null;

  const share = await calculateRevenueShare(db, tenantId);
  if (share.revenueShareOwed <= 0) return null;

  // Check ROI guarantee — during soft launch this applies to ALL tenants
  const roi = await checkRoiGuarantee(db, tenantId);
  if (roi.guaranteeActive) {
    console.log(
      `[billing] Skipped invoice for tenant ${tenantId}: ROI guarantee active ` +
      `(ROI ${roi.roiPercent}%, threshold ${ROI_SAFETY_MARGIN_PERCENT}%, soft_launch=${SOFT_LAUNCH_MODE})`
    );
    return { skipped: true, reason: "ROI guarantee active - insufficient ROI", ...roi };
  }

  try {
    // Create a Stripe invoice item for the revenue share
    const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripeId);
    const customerId = stripeSubscription.customer as string;

    // Use tenant's actual currency from their settings/subscription
    const currency = share.currency || "usd";

    await stripe.invoiceItems.create({
      customer: customerId,
      amount: Math.round(share.revenueShareOwed * 100), // convert to cents
      currency,
      description: `Revenue share (${share.revenueSharePercent}%) - ${share.recoveredAppointments} recovered appointments`,
    });

    return { success: true, amount: share.revenueShareOwed, currency, ...share };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
