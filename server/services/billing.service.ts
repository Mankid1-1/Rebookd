import { and, desc, eq } from "drizzle-orm";
import Stripe from "stripe";
import { billingInvoices, billingRefunds, subscriptions } from "../../drizzle/schema";
import type { Db } from "../_core/context";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });

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
    billing_cycle_anchor: "unchanged",
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
