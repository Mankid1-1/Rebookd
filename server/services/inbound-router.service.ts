/**
 * INBOUND MESSAGE ROUTER
 *
 * Intercepts inbound SMS messages before they reach the normal inbox.
 * Routes special reply patterns to their respective feature handlers:
 *   Priority 1: Rating replies (1-5) → Smart Review Routing
 *   Priority 2: YES/NO replies → Waiting List Auto-Fill
 *
 * Falls through to normal processing if no pattern matches.
 */

import { and, eq, gt } from "drizzle-orm";
import { reviewRequests, waitlistOffers } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { logger } from "../_core/logger";
import * as ReviewRoutingService from "./review-routing.service";
import * as WaitlistAutofillService from "./waitlist-autofill.service";

export interface InboundRouteResult {
  handled: boolean;
  handler?: "review_rating" | "waitlist_reply";
}

/**
 * Attempt to route an inbound SMS to a feature handler.
 * Returns { handled: true } if the message was consumed by a handler,
 * { handled: false } if it should continue to normal inbox processing.
 */
export async function routeInboundMessage(
  db: Db,
  tenantId: number,
  leadId: number,
  messageBody: string,
): Promise<InboundRouteResult> {
  const body = messageBody.trim();

  // ── Priority 1: Rating reply (1-5) for active review request ──────────
  const ratingMatch = body.match(/^([1-5])$/);
  if (ratingMatch) {
    const hasActiveReview = await hasActiveReviewRequest(db, tenantId, leadId);
    if (hasActiveReview) {
      const rating = parseInt(ratingMatch[1], 10);
      try {
        await ReviewRoutingService.processRatingReply(db, tenantId, leadId, rating);
        logger.info("Inbound router: rating reply handled", { tenantId, leadId, rating });
        return { handled: true, handler: "review_rating" };
      } catch (err) {
        logger.warn("Inbound router: review rating handler failed", {
          tenantId, leadId, error: String(err),
        });
        // Fall through to normal processing
      }
    }
  }

  // ── Priority 2: YES/NO reply for active waitlist offer ────────────────
  const yesNoMatch = body.match(/^(yes|no|y|n)$/i);
  if (yesNoMatch) {
    const hasActiveOffer = await hasActiveWaitlistOffer(db, tenantId, leadId);
    if (hasActiveOffer) {
      const isAccept = /^(yes|y)$/i.test(yesNoMatch[1]);
      try {
        await WaitlistAutofillService.handleWaitlistReply(db, tenantId, leadId, isAccept);
        logger.info("Inbound router: waitlist reply handled", { tenantId, leadId, isAccept });
        return { handled: true, handler: "waitlist_reply" };
      } catch (err) {
        logger.warn("Inbound router: waitlist reply handler failed", {
          tenantId, leadId, error: String(err),
        });
        // Fall through to normal processing
      }
    }
  }

  return { handled: false };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function hasActiveReviewRequest(db: Db, tenantId: number, leadId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: reviewRequests.id })
    .from(reviewRequests)
    .where(
      and(
        eq(reviewRequests.tenantId, tenantId),
        eq(reviewRequests.leadId, leadId),
        eq(reviewRequests.status, "sent"),
        gt(reviewRequests.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return !!row;
}

async function hasActiveWaitlistOffer(db: Db, tenantId: number, leadId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: waitlistOffers.id })
    .from(waitlistOffers)
    .where(
      and(
        eq(waitlistOffers.tenantId, tenantId),
        eq(waitlistOffers.leadId, leadId),
        eq(waitlistOffers.status, "sent"),
        gt(waitlistOffers.responseDeadline, new Date()),
      ),
    )
    .limit(1);
  return !!row;
}
