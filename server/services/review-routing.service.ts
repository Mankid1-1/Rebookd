/**
 * SMART REVIEW ROUTING SERVICE
 *
 * Routes post-appointment review requests based on rating:
 *   - High ratings (>= threshold) → public review link (Google/Yelp)
 *   - Low ratings (< threshold)   → private feedback form
 *
 * Flow:
 *   1. createReviewRequest → SMS asking for 1-5 rating
 *   2. processRatingReply  → routes to review link or feedback form
 *   3. submitFeedback      → captures private feedback via token
 */

import crypto from "crypto";
import { eq, and, gt, sql, desc, count } from "drizzle-orm";
import { reviewRequests, tenants, leads } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import * as LeadService from "./lead.service";
import * as TenantService from "./tenant.service";
import { createLinkToken } from "./link-token.service";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReviewRoutingConfig {
  googleUrl?: string;
  yelpUrl?: string;
  facebookUrl?: string;
  /** Rating threshold — ratings >= this go to public review. Default 4. */
  threshold?: number;
  /** Preferred platform when multiple URLs configured */
  preferredPlatform?: "google" | "yelp" | "facebook";
}

interface ReviewMetrics {
  totalRequests: number;
  averageRating: number | null;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  reviewClickRate: number;
  feedbackSubmissionRate: number;
}

const DEFAULT_THRESHOLD = 4;
const REVIEW_REQUEST_EXPIRY_HOURS = 72;

// ─── Create Review Request ──────────────────────────────────────────────────

/**
 * Creates a review request and sends the initial rating-request SMS.
 */
export async function createReviewRequest(
  db: Db,
  tenantId: number,
  leadId: number,
) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + REVIEW_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000);

  // Insert review request row
  await db.insert(reviewRequests).values({
    tenantId,
    leadId,
    token,
    status: "sent",
    expiresAt,
  });

  // Get the newly inserted row
  const [request] = await db
    .select()
    .from(reviewRequests)
    .where(and(eq(reviewRequests.tenantId, tenantId), eq(reviewRequests.token, token)))
    .limit(1);

  // Fetch lead details for personalisation
  const lead = await LeadService.getLeadById(db, tenantId, leadId);
  if (!lead) {
    logger.error("Review request created but lead not found", { tenantId, leadId });
    return request;
  }

  const name = lead.name || "there";
  const smsBody = `Hi ${name}, how was your visit? Reply with a number 1-5 (5 = amazing!)`;

  try {
    await sendSMS(lead.phone, smsBody, undefined, tenantId);

    // Log the outbound message
    await LeadService.createMessage(db, {
      tenantId,
      leadId,
      direction: "outbound",
      body: smsBody,
      toNumber: lead.phone,
      status: "sent",
    });

    logger.info("Review request SMS sent", { tenantId, leadId, requestId: request?.id });
  } catch (err) {
    logger.error("Failed to send review request SMS", {
      tenantId,
      leadId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return request;
}

// ─── Process Rating Reply ───────────────────────────────────────────────────

/**
 * Called when a lead replies with a 1-5 rating.
 * Routes to public review or private feedback based on threshold.
 */
export async function processRatingReply(
  db: Db,
  tenantId: number,
  leadId: number,
  rating: number,
) {
  // Clamp rating to 1-5
  const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));

  // Find the active (sent, not expired) review request for this lead
  const [request] = await db
    .select()
    .from(reviewRequests)
    .where(
      and(
        eq(reviewRequests.tenantId, tenantId),
        eq(reviewRequests.leadId, leadId),
        eq(reviewRequests.status, "sent"),
        gt(reviewRequests.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(reviewRequests.createdAt))
    .limit(1);

  if (!request) {
    logger.warn("No active review request found for rating reply", { tenantId, leadId });
    return null;
  }

  // Update the request with the rating
  await db
    .update(reviewRequests)
    .set({
      status: "rated",
      rating: clampedRating,
      ratedAt: new Date(),
    })
    .where(eq(reviewRequests.id, request.id));

  // Get tenant settings for review routing config
  const tenant = await TenantService.getTenantById(db, tenantId);
  const config: ReviewRoutingConfig = (tenant?.settings as any)?.reviewRouting ?? {};
  const threshold = config.threshold ?? DEFAULT_THRESHOLD;

  const lead = await LeadService.getLeadById(db, tenantId, leadId);
  if (!lead) {
    logger.error("Lead not found during rating processing", { tenantId, leadId });
    return request;
  }

  if (clampedRating >= threshold) {
    // ── High rating → public review link ──
    const reviewUrl = getPreferredReviewUrl(config);
    let platform: string | undefined;

    if (reviewUrl) {
      platform = detectPlatform(reviewUrl, config);

      const smsBody = `Thank you! We'd love a review: ${reviewUrl}`;
      try {
        await sendSMS(lead.phone, smsBody, undefined, tenantId);
        await LeadService.createMessage(db, {
          tenantId,
          leadId,
          direction: "outbound",
          body: smsBody,
          toNumber: lead.phone,
          status: "sent",
        });
      } catch (err) {
        logger.error("Failed to send review link SMS", {
          tenantId,
          leadId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      await db
        .update(reviewRequests)
        .set({ reviewPlatform: platform ?? "unknown" })
        .where(eq(reviewRequests.id, request.id));
    } else {
      // No review URL configured — send a simple thank-you
      const smsBody = "Thank you for the great rating! We appreciate your support.";
      try {
        await sendSMS(lead.phone, smsBody, undefined, tenantId);
        await LeadService.createMessage(db, {
          tenantId,
          leadId,
          direction: "outbound",
          body: smsBody,
          toNumber: lead.phone,
          status: "sent",
        });
      } catch (err) {
        logger.error("Failed to send thank-you SMS", {
          tenantId,
          leadId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } else {
    // ── Low rating → private feedback form ──
    const { url: feedbackUrl } = await createLinkToken(db, tenantId, leadId, "feedback", 72);

    const smsBody = `Thanks for the feedback. We'd love to hear more so we can improve: ${feedbackUrl}`;
    try {
      await sendSMS(lead.phone, smsBody, undefined, tenantId);
      await LeadService.createMessage(db, {
        tenantId,
        leadId,
        direction: "outbound",
        body: smsBody,
        toNumber: lead.phone,
        status: "sent",
      });
    } catch (err) {
      logger.error("Failed to send feedback request SMS", {
        tenantId,
        leadId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Return updated record
  const [updated] = await db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.id, request.id))
    .limit(1);

  return updated;
}

// ─── Submit Feedback ────────────────────────────────────────────────────────

/**
 * Submits private feedback via the token-authenticated feedback page.
 */
export async function submitFeedback(
  db: Db,
  token: string,
  feedbackText: string,
) {
  const [request] = await db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.token, token))
    .limit(1);

  if (!request) {
    logger.warn("Feedback submission: token not found", { token: token.slice(0, 8) + "..." });
    return { success: false, reason: "invalid_token" } as const;
  }

  if (new Date(request.expiresAt) < new Date()) {
    logger.warn("Feedback submission: token expired", { requestId: request.id });
    return { success: false, reason: "expired" } as const;
  }

  if (request.status === "feedback_submitted") {
    logger.warn("Feedback submission: already submitted", { requestId: request.id });
    return { success: false, reason: "already_submitted" } as const;
  }

  await db
    .update(reviewRequests)
    .set({
      status: "feedback_submitted",
      feedbackText,
    })
    .where(eq(reviewRequests.id, request.id));

  logger.info("Feedback submitted", { requestId: request.id, tenantId: request.tenantId });

  return { success: true } as const;
}

// ─── Metrics ────────────────────────────────────────────────────────────────

/**
 * Aggregated review metrics for a tenant's dashboard.
 */
export async function getReviewMetrics(db: Db, tenantId: number): Promise<ReviewMetrics> {
  // Total requests
  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(reviewRequests)
    .where(eq(reviewRequests.tenantId, tenantId));
  const totalRequests = Number(totalRow?.count ?? 0);

  // Average rating (only rated requests)
  const [avgRow] = await db
    .select({ avg: sql<number | null>`AVG(${reviewRequests.rating})` })
    .from(reviewRequests)
    .where(and(eq(reviewRequests.tenantId, tenantId), sql`${reviewRequests.rating} IS NOT NULL`));
  const averageRating = avgRow?.avg ? Math.round(Number(avgRow.avg) * 100) / 100 : null;

  // Rating distribution
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const distRows = await db
    .select({
      rating: reviewRequests.rating,
      count: sql<number>`COUNT(*)`,
    })
    .from(reviewRequests)
    .where(and(eq(reviewRequests.tenantId, tenantId), sql`${reviewRequests.rating} IS NOT NULL`))
    .groupBy(reviewRequests.rating);

  for (const row of distRows) {
    if (row.rating && row.rating >= 1 && row.rating <= 5) {
      distribution[row.rating as 1 | 2 | 3 | 4 | 5] = Number(row.count);
    }
  }

  // Review click rate
  const [clickedRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(reviewRequests)
    .where(
      and(eq(reviewRequests.tenantId, tenantId), eq(reviewRequests.reviewLinkClicked, true)),
    );
  const clickedCount = Number(clickedRow?.count ?? 0);
  const ratedHighCount = Object.entries(distribution)
    .filter(([k]) => Number(k) >= (DEFAULT_THRESHOLD))
    .reduce((sum, [, v]) => sum + v, 0);
  const reviewClickRate = ratedHighCount > 0 ? clickedCount / ratedHighCount : 0;

  // Feedback submission rate
  const [feedbackRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(reviewRequests)
    .where(
      and(eq(reviewRequests.tenantId, tenantId), eq(reviewRequests.status, "feedback_submitted")),
    );
  const feedbackCount = Number(feedbackRow?.count ?? 0);
  const ratedLowCount = Object.entries(distribution)
    .filter(([k]) => Number(k) < DEFAULT_THRESHOLD)
    .reduce((sum, [, v]) => sum + v, 0);
  const feedbackSubmissionRate = ratedLowCount > 0 ? feedbackCount / ratedLowCount : 0;

  return {
    totalRequests,
    averageRating,
    ratingDistribution: distribution,
    reviewClickRate: Math.round(reviewClickRate * 10000) / 10000,
    feedbackSubmissionRate: Math.round(feedbackSubmissionRate * 10000) / 10000,
  };
}

// ─── List Review Requests ───────────────────────────────────────────────────

export async function listReviewRequests(
  db: Db,
  tenantId: number,
  opts?: { page?: number; limit?: number; status?: string },
) {
  const limit = opts?.limit ?? 20;
  const page = opts?.page ?? 1;

  const conditions = [eq(reviewRequests.tenantId, tenantId)];
  if (opts?.status) {
    conditions.push(eq(reviewRequests.status, opts.status as any));
  }

  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(reviewRequests)
    .where(and(...conditions));
  const total = Number(totalRow?.count ?? 0);

  const rows = await db
    .select()
    .from(reviewRequests)
    .where(and(...conditions))
    .orderBy(desc(reviewRequests.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return { requests: rows, total };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPreferredReviewUrl(config: ReviewRoutingConfig): string | undefined {
  if (config.preferredPlatform) {
    const urlMap: Record<string, string | undefined> = {
      google: config.googleUrl,
      yelp: config.yelpUrl,
      facebook: config.facebookUrl,
    };
    if (urlMap[config.preferredPlatform]) return urlMap[config.preferredPlatform];
  }
  // Fall back to first available
  return config.googleUrl || config.yelpUrl || config.facebookUrl;
}

function detectPlatform(
  url: string,
  config: ReviewRoutingConfig,
): string {
  if (config.preferredPlatform) return config.preferredPlatform;
  if (url === config.googleUrl) return "google";
  if (url === config.yelpUrl) return "yelp";
  if (url === config.facebookUrl) return "facebook";
  if (url.includes("google")) return "google";
  if (url.includes("yelp")) return "yelp";
  if (url.includes("facebook")) return "facebook";
  return "unknown";
}
