import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { subscriptions, plans } from "../../drizzle/schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });

export function registerStripeWebhook(app: Express) {
  // Stripe requires the raw body to verify signatures. We mount raw body parsing for this route only.
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string | undefined;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !webhookSecret) {
        console.warn("Stripe webhook called without signature or webhook secret configured");
        return res.status(400).send("Missing signature/webhook secret");
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Stripe] Webhook constructEvent error:", err?.message || err);
        return res.status(400).send(`Webhook Error: ${err?.message || "invalid payload"}`);
      }

      try {
        const db = await getDb();
        if (!db) {
          console.error("[Stripe] Database unavailable for webhook processing");
          return res.status(500).send("Database unavailable");
        }

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const stripeSubId = session.subscription as string | undefined;
            const tenantId = session.metadata ? Number(session.metadata.tenantId) : undefined;

            if (stripeSubId && tenantId) {
              // fetch subscription details from Stripe
              const sub = await stripe.subscriptions.retrieve(stripeSubId, { expand: ["items.data.price.product"] }).catch(() => null);

              const status = sub?.status || "active";
              const periodStart = sub?.current_period_start ? new Date(sub.current_period_start * 1000) : undefined;
              const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end * 1000) : undefined;

              // Determine planId from Stripe price id
              let planId = 1;
              const priceId = (sub as any)?.items?.data?.[0]?.price?.id as string | undefined;
              if (priceId) {
                const planRows = await db.select().from(plans).where(plans.stripePriceId.eq(priceId)).limit(1);
                if (planRows[0]) planId = planRows[0].id;
              }

              // Upsert subscription record for tenant
              const existing = await db.select().from(subscriptions).where(subscriptions.tenantId.eq(tenantId)).limit(1);
              if (existing[0]) {
                await db
                  .update(subscriptions)
                  .set({ stripeId: stripeSubId, status, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, planId })
                  .where(subscriptions.tenantId.eq(tenantId));
              } else {
                await db.insert(subscriptions).values({
                  tenantId,
                  planId,
                  stripeId: stripeSubId,
                  status: status as any,
                  currentPeriodStart: periodStart,
                  currentPeriodEnd: periodEnd,
                });
              }
            }

            break;
          }

          case "invoice.paid": {
            // Mark subscription as active
            const invoice = event.data.object as Stripe.Invoice;
            const stripeSubId = invoice.subscription as string | undefined;
            if (stripeSubId) {
              await getDb().then(async (db) => {
                const rows = await db.select().from(subscriptions).where(subscriptions.stripeId.eq(stripeSubId)).limit(1);
                if (rows[0]) {
                  await db.update(subscriptions).set({ status: "active", currentPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : undefined, currentPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined }).where(subscriptions.id.eq(rows[0].id));
                }
              });
            }
            break;
          }

          case "invoice.payment_failed": {
            // Mark subscription as past_due
            const invoice = event.data.object as Stripe.Invoice;
            const stripeSubId = invoice.subscription as string | undefined;
            if (stripeSubId) {
              await getDb().then(async (db) => {
                const rows = await db.select().from(subscriptions).where(subscriptions.stripeId.eq(stripeSubId)).limit(1);
                if (rows[0]) {
                  await db.update(subscriptions).set({ status: "past_due" }).where(subscriptions.id.eq(rows[0].id));
                }
              });
            }
            break;
          }

          case "customer.subscription.updated":
          case "customer.subscription.created":
          case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            const stripeId = sub.id;

            // Try to find by stripeId and update status/periods and planId if available
            await getDb().then(async (db) => {
              const rows = await db.select().from(subscriptions).where(subscriptions.stripeId.eq(stripeId)).limit(1);
              if (rows[0]) {
                // attempt to map to planId from subscription items
                let planId = rows[0].planId;
                const priceId = (sub as any)?.items?.data?.[0]?.price?.id as string | undefined;
                if (priceId) {
                  const planRows = await db.select().from(plans).where(plans.stripePriceId.eq(priceId)).limit(1);
                  if (planRows[0]) planId = planRows[0].id;
                }

                await db
                  .update(subscriptions)
                  .set({ status: sub.status as any, currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined, currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined, planId })
                  .where(subscriptions.id.eq(rows[0].id));
              }
            });

            break;
          }

          default:
            // ignore other events for now
            break;
        }

        res.json({ received: true });
      } catch (err) {
        console.error("[Stripe] Webhook handler error:", err);
        res.status(500).send("Internal error");
      }
    }
  );
}
