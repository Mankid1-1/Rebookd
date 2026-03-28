import { eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { billingInvoices, plans, subscriptions } from "../../drizzle/schema";
import * as BillingService from "../services/billing.service";
import { ENV } from "./env";
import type { Db } from "./context";

export const stripe = new Stripe(ENV.stripeSecretKey || "", { apiVersion: "2022-11-15" });

async function getSubscriptionByStripeId(db: Db, stripeId: string) {
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.stripeId, stripeId)).limit(1);
  return rows[0];
}

async function resolvePlanId(db: Db, priceId?: string, fallback = 1) {
  if (!priceId) return fallback;
  const planRows = await db.select().from(plans).where(eq(plans.stripePriceId, priceId)).limit(1);
  return planRows[0]?.id ?? fallback;
}

export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string | undefined;
      const webhookSecret = ENV.stripeWebhookSecret;
      if (!sig || !webhookSecret) {
        return res.status(400).send("Missing signature/webhook secret");
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
      } catch (err) {
        return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : "invalid payload"}`);
      }

      try {
        const db = await getDb();
        if (!db) return res.status(500).send("Database unavailable");

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const stripeSubId = session.subscription as string | undefined;
            const tenantId = session.metadata ? Number(session.metadata.tenantId) : undefined;
            if (!stripeSubId || !tenantId) break;
            const sub = await stripe.subscriptions.retrieve(stripeSubId, { expand: ["items.data.price"] }).catch(() => null);
            const priceId = sub?.items.data[0]?.price?.id;
            const planId = await resolvePlanId(db, priceId, 1);
            const existing = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).limit(1);
            const payload = {
              stripeId: stripeSubId,
              status: (sub?.status || "active") as "active" | "trialing" | "past_due" | "canceled" | "unpaid",
              planId,
              currentPeriodStart: sub?.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
              currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
              trialEndsAt: sub?.trial_end ? new Date(sub.trial_end * 1000) : undefined,
            };
            if (existing[0]) {
              await db.update(subscriptions).set(payload).where(eq(subscriptions.id, existing[0].id));
            } else {
              await db.insert(subscriptions).values({ tenantId, ...payload });
            }
            break;
          }

          case "invoice.paid":
          case "invoice.payment_failed":
          case "invoice.finalized": {
            const invoice = event.data.object as Stripe.Invoice;
            const stripeSubId = invoice.subscription as string | undefined;
            if (!stripeSubId) break;
            const subscription = await getSubscriptionByStripeId(db, stripeSubId);
            if (!subscription) break;
            await BillingService.upsertInvoiceFromStripeEvent(db, {
              tenantId: subscription.tenantId,
              subscriptionId: subscription.id,
              invoice,
            });
            await db.update(subscriptions).set({
              status: event.type === "invoice.payment_failed" ? "past_due" : "active",
              currentPeriodStart: (invoice as Stripe.Invoice & { period_start?: number }).period_start ? new Date((invoice as Stripe.Invoice & { period_start?: number }).period_start! * 1000) : undefined,
              currentPeriodEnd: (invoice as Stripe.Invoice & { period_end?: number }).period_end ? new Date((invoice as Stripe.Invoice & { period_end?: number }).period_end! * 1000) : undefined,
            }).where(eq(subscriptions.id, subscription.id));
            break;
          }

          case "charge.refunded": {
            const charge = event.data.object as Stripe.Charge;
            if (!charge.invoice || typeof charge.invoice !== "string") break;
            const [invoiceRow] = await db
              .select()
              .from(billingInvoices)
              .where(eq(billingInvoices.stripeInvoiceId, charge.invoice))
              .limit(1);
            if (!invoiceRow) break;
            const refunds = await stripe.refunds.list({ charge: charge.id, limit: 10 });
            for (const refund of refunds.data) {
              await BillingService.createRefundRecord(db, {
                tenantId: invoiceRow.tenantId,
                subscriptionId: invoiceRow.subscriptionId ?? undefined,
                billingInvoiceId: invoiceRow.id,
                refund,
              });
            }
            break;
          }

          case "customer.subscription.updated":
          case "customer.subscription.created":
          case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            const subscription = await getSubscriptionByStripeId(db, sub.id);
            if (!subscription) break;
            const priceId = sub.items.data[0]?.price?.id;
            const planId = await resolvePlanId(db, priceId, subscription.planId);
            await db
              .update(subscriptions)
              .set({
                status: sub.status as "active" | "trialing" | "past_due" | "canceled" | "unpaid",
                currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
                currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
                trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : undefined,
                planId,
              })
              .where(eq(subscriptions.id, subscription.id));
            break;
          }
        }

        res.json({ received: true });
      } catch (err) {
        console.error("[Stripe] Webhook handler error:", err);
        res.status(500).send("Internal error");
      }
    },
  );
}
