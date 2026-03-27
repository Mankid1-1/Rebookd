import { eq, and, inArray } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { billingInvoices, plans, subscriptions, recoveryEvents } from "../../drizzle/schema";
import * as BillingService from "../services/billing.service";
import * as RecoveryAttribution from "../services/recovery-attribution.service";
import * as RoiGuarantee from "../services/roi-guarantee.service";
import { reportRevenueUsage } from "../services/stripe-checkout.service";
import { ENV } from "./env";
import type { Db } from "./context";
import { logger } from "./logger";

const stripe = new Stripe(ENV.stripeSecretKey || "", { apiVersion: "2022-11-15" });

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
      } catch (err: any) {
        return res.status(400).send(`Webhook Error: ${err?.message || "invalid payload"}`);
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
              status: (sub?.status || "active") as any,
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
              currentPeriodStart: (invoice as any).period_start ? new Date((invoice as any).period_start * 1000) : undefined,
              currentPeriodEnd: (invoice as any).period_end ? new Date((invoice as any).period_end * 1000) : undefined,
            }).where(eq(subscriptions.id, subscription.id));

            // Link Stripe payment to recovery events and report metered usage
            if (event.type === "invoice.paid" && invoice.payment_intent) {
              const paymentIntentId = typeof invoice.payment_intent === "string"
                ? invoice.payment_intent
                : invoice.payment_intent.id;
              const amountPaid = invoice.amount_paid || 0; // in cents

              // Find ALL "converted" recovery events for this tenant and realize them
              // No artificial limit — process all pending conversions
              const convertedEvents = await db
                .select()
                .from(recoveryEvents)
                .where(and(
                  eq(recoveryEvents.tenantId, subscription.tenantId),
                  eq(recoveryEvents.status, "converted"),
                  eq(recoveryEvents.isPrimaryAttribution, true),
                ));

              for (const re of convertedEvents) {
                try {
                  await RecoveryAttribution.markRecoveryRealized(db, subscription.tenantId, re.leadId, {
                    stripePaymentIntentId: paymentIntentId,
                    stripeInvoiceId: invoice.id,
                    realizedRevenue: re.estimatedRevenue, // use estimated until we can link exact amounts
                  });
                } catch (err) {
                  logger.warn("Failed to realize recovery event", { recoveryEventId: re.id, error: String(err) });
                }
              }

              // Report recovered revenue to Stripe metered billing (15% commission)
              if (convertedEvents.length > 0) {
                const totalRealized = convertedEvents.reduce((sum, e) => sum + e.estimatedRevenue, 0);
                const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
                if (customerId && totalRealized > 0) {
                  try {
                    await reportRevenueUsage(customerId, Math.round(totalRealized / 100)); // convert cents to dollars
                    logger.info("Reported metered revenue usage to Stripe", { tenantId: subscription.tenantId, amount: totalRealized });
                  } catch (err) {
                    logger.warn("Failed to report metered usage", { error: String(err) });
                  }
                }
              }
            }

            // Evaluate ROI guarantee on each billing cycle
            try {
              const result = await RoiGuarantee.evaluateGuarantee(db, subscription.tenantId);
              if (result.action === "refund_eligible") {
                logger.warn("ROI guarantee refund eligible — admin action needed", {
                  tenantId: subscription.tenantId,
                  clientNetROI: result.roi?.clientNetROI,
                });
              }
            } catch (err) {
              logger.warn("Failed to evaluate ROI guarantee", { tenantId: subscription.tenantId, error: String(err) });
            }
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
                status: sub.status as any,
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
