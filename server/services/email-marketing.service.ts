/**
 * Email Marketing Service
 *
 * Manages drip email sequences for pre-signup leads and users.
 * Uses the existing sendEmail() infrastructure (SMTP or SendGrid).
 *
 * Sequences:
 * - welcome: 5-email drip for new email captures via ROI calculator
 * - onboarding-nudge: 3-email for users who signed up but didn't finish onboarding
 * - activation: 2-email post-setup encouragement
 * - referral-prompt: 1-email after first recovery success
 */

import { sendEmail } from "../_core/email";
import { logger } from "../_core/logger";
import type { MySql2Database } from "drizzle-orm/mysql2";

// ─── Sequence Definitions ──────────────────────────────────────────────────

interface SequenceStep {
  delayDays: number;
  subject: string;
  buildHtml: (ctx: Record<string, any>) => string;
  buildText: (ctx: Record<string, any>) => string;
}

const SEQUENCES: Record<string, SequenceStep[]> = {
  welcome: [
    {
      delayDays: 0, // Immediate
      subject: "Your personalized ROI breakdown from Rebooked",
      buildHtml: (ctx) => roiReportEmail(ctx),
      buildText: (ctx) => `Hi ${ctx.name || "there"},\n\nHere's your personalized ROI breakdown:\n\nPotential monthly recovery: $${ctx.grossRevenue || 0}\nEstimated ROI: ${ctx.roi || 0}%\n\nClaim your free spot: https://rebooked.org/login\n\n— Brendan, Rebooked`,
    },
    {
      delayDays: 2,
      subject: "How a salon recovered $2,400/month (without lifting a finger)",
      buildHtml: (ctx) => caseStudyEmail(ctx),
      buildText: (ctx) => `Hi ${ctx.name || "there"},\n\nKayla from Studio K Hair Lounge recovered 11 no-shows in her first month — that's $700 back without doing anything.\n\nSee how it works: https://rebooked.org\n\n— Brendan, Rebooked`,
    },
    {
      delayDays: 5,
      subject: "The real cost of doing nothing about no-shows",
      buildHtml: (ctx) => painAmplificationEmail(ctx),
      buildText: (ctx) => `Hi ${ctx.name || "there"},\n\nEvery no-show costs you about $${ctx.avgValue || 80}. At ${ctx.noShows || 15} no-shows per month, that's $${(ctx.avgValue || 80) * (ctx.noShows || 15)} walking out the door.\n\nRebooked recovers 40% of those automatically.\n\nTry it free: https://rebooked.org/login\n\n— Brendan, Rebooked`,
    },
    {
      delayDays: 9,
      subject: "Your free 35-day trial is waiting",
      buildHtml: (ctx) => trialInviteEmail(ctx),
      buildText: (ctx) => `Hi ${ctx.name || "there"},\n\nRebooked is completely free for 35 days. If you don't see positive ROI, you don't pay. Simple as that.\n\nStart now: https://rebooked.org/login\n\n— Brendan, Rebooked`,
    },
    {
      delayDays: 14,
      subject: "Only a few Founder Spots left",
      buildHtml: (ctx) => urgencyEmail(ctx),
      buildText: (ctx) => `Hi ${ctx.name || "there"},\n\nFounder Spots give you Rebooked completely free — forever. No monthly fee, no revenue share. We only have 10 and they're filling up.\n\nClaim yours: https://rebooked.org/login\n\n— Brendan, Rebooked`,
    },
  ],
  "onboarding-nudge": [
    {
      delayDays: 1,
      subject: "You're 2 minutes from your first recovered appointment",
      buildHtml: (ctx) => nudgeEmail(ctx, 1),
      buildText: (ctx) => `Hi ${ctx.name || "there"},\n\nYou signed up for Rebooked but haven't finished setup yet. It takes about 2 minutes.\n\nFinish setup: https://rebooked.org/onboarding\n\n— Brendan, Rebooked`,
    },
    {
      delayDays: 3,
      subject: "Quick question about your setup",
      buildHtml: (ctx) => nudgeEmail(ctx, 2),
      buildText: (ctx) => `Hi ${ctx.name || "there"},\n\nNoticed you haven't finished setting up Rebooked. Is something blocking you? Reply to this email — I read every one.\n\n— Brendan, Rebooked`,
    },
    {
      delayDays: 7,
      subject: "Last chance: your Rebooked setup is waiting",
      buildHtml: (ctx) => nudgeEmail(ctx, 3),
      buildText: (ctx) => `Hi ${ctx.name || "there"},\n\nYour Rebooked account is set up and ready. All you need to do is connect your calendar and choose your automations.\n\nFinish setup: https://rebooked.org/onboarding\n\n— Brendan, Rebooked`,
    },
  ],
};

// ─── Core Functions ────────────────────────────────────────────────────────

/**
 * Enroll an email subscriber in a drip sequence.
 */
export async function enrollInSequence(
  db: MySql2Database<any>,
  subscriberId: number,
  sequenceName: string,
  context: Record<string, any> = {},
): Promise<void> {
  const sequence = SEQUENCES[sequenceName];
  if (!sequence) {
    logger.warn("Unknown email sequence", { sequenceName });
    return;
  }

  const now = new Date();

  for (let i = 0; i < sequence.length; i++) {
    const step = sequence[i];
    const scheduledAt = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000);

    await db.execute({
      sql: `INSERT INTO email_sequence_queue (subscriberId, sequenceName, stepIndex, scheduledAt, status)
            VALUES (?, ?, ?, ?, 'pending')`,
      params: [subscriberId, sequenceName, i, scheduledAt],
    });
  }

  logger.info("Enrolled in email sequence", { subscriberId, sequenceName, steps: sequence.length });
}

/**
 * Process pending email sequence items that are due.
 * Called by the background worker on a 5-minute interval.
 */
export async function processEmailSequenceQueue(db: MySql2Database<any>): Promise<number> {
  // Fetch up to 20 pending items that are due
  const [rows] = await db.execute({
    sql: `SELECT q.id, q.subscriberId, q.sequenceName, q.stepIndex,
                 s.email, s.name, s.roiData, s.industry, s.status as subStatus
          FROM email_sequence_queue q
          JOIN email_subscribers s ON s.id = q.subscriberId
          WHERE q.status = 'pending' AND q.scheduledAt <= NOW()
          ORDER BY q.scheduledAt ASC
          LIMIT 20`,
    params: [],
  });

  const items = rows as any[];
  if (!items.length) return 0;

  let sent = 0;

  for (const item of items) {
    // Skip if subscriber unsubscribed
    if (item.subStatus !== "active") {
      await db.execute({
        sql: `UPDATE email_sequence_queue SET status = 'skipped', sentAt = NOW() WHERE id = ?`,
        params: [item.id],
      });
      continue;
    }

    const sequence = SEQUENCES[item.sequenceName];
    if (!sequence || !sequence[item.stepIndex]) {
      await db.execute({
        sql: `UPDATE email_sequence_queue SET status = 'skipped', sentAt = NOW() WHERE id = ?`,
        params: [item.id],
      });
      continue;
    }

    const step = sequence[item.stepIndex];
    const roiData = typeof item.roiData === "string" ? JSON.parse(item.roiData) : item.roiData || {};
    const ctx = { name: item.name, email: item.email, industry: item.industry, ...roiData };

    try {
      const result = await sendEmail({
        to: item.email,
        subject: step.subject,
        text: step.buildText(ctx),
        html: step.buildHtml(ctx),
      });

      await db.execute({
        sql: `UPDATE email_sequence_queue SET status = ?, sentAt = NOW() WHERE id = ?`,
        params: [result.success ? "sent" : "failed", item.id],
      });

      if (result.success) sent++;
    } catch (err) {
      logger.error("Failed to send sequence email", { id: item.id, error: String(err) });
      await db.execute({
        sql: `UPDATE email_sequence_queue SET status = 'failed', sentAt = NOW() WHERE id = ?`,
        params: [item.id],
      });
    }
  }

  if (sent > 0) {
    logger.info("Processed email sequence queue", { sent, total: items.length });
  }

  return sent;
}

/**
 * Unsubscribe an email address from all sequences.
 */
export async function unsubscribe(db: MySql2Database<any>, email: string): Promise<void> {
  await db.execute({
    sql: `UPDATE email_subscribers SET status = 'unsubscribed', unsubscribedAt = NOW() WHERE email = ?`,
    params: [email],
  });

  // Cancel all pending sequence items
  await db.execute({
    sql: `UPDATE email_sequence_queue SET status = 'skipped'
          WHERE subscriberId IN (SELECT id FROM email_subscribers WHERE email = ?)
            AND status = 'pending'`,
    params: [email],
  });
}

// ─── Email Templates ───────────────────────────────────────────────────────
// Simple, clean emails using inline styles — no external dependencies.

const brandStyles = {
  navy: "#0D1B2A",
  teal: "#00A896",
  gold: "#E8920A",
  bg: "#f8f9fa",
  white: "#ffffff",
};

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${brandStyles.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:20px;font-weight:700;color:${brandStyles.navy};letter-spacing:-0.5px;">Rebooked</span>
    </div>
    <div style="background:${brandStyles.white};border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      ${content}
    </div>
    <div style="text-align:center;margin-top:24px;font-size:12px;color:#9ca3af;">
      <p>Rebooked &middot; AI-powered SMS revenue recovery</p>
      <p><a href="https://rebooked.org/unsubscribe?email={{email}}" style="color:#9ca3af;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;padding:12px 32px;background:${brandStyles.teal};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${text}</a>
  </div>`;
}

function roiReportEmail(ctx: Record<string, any>): string {
  const grossRevenue = ctx.grossRevenue || 0;
  const roi = ctx.roi || 0;
  return emailWrapper(`
    <h2 style="color:${brandStyles.navy};font-size:20px;margin:0 0 8px;">Your ROI Breakdown</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Hi ${ctx.name || "there"}, here's what Rebooked could recover for your ${ctx.industry || "business"} every month.</p>
    <div style="background:${brandStyles.bg};border-radius:8px;padding:16px;margin:16px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#6b7280;font-size:13px;">Potential monthly recovery</span>
        <span style="font-weight:700;color:${brandStyles.teal};font-size:16px;">$${grossRevenue.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#6b7280;font-size:13px;">Estimated ROI</span>
        <span style="font-weight:700;color:${brandStyles.teal};font-size:16px;">${roi}%</span>
      </div>
    </div>
    <p style="color:#6b7280;font-size:13px;">Based on 40% no-show recovery and 55% cancellation rebook rate.</p>
    ${ctaButton("Claim your free spot", "https://rebooked.org/login")}
    <p style="color:#9ca3af;font-size:12px;text-align:center;">No credit card required. 35-day ROI guarantee.</p>
  `);
}

function caseStudyEmail(ctx: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:${brandStyles.navy};font-size:20px;margin:0 0 8px;">From 11 no-shows to $700 recovered</h2>
    <p style="color:#6b7280;font-size:14px;">Hi ${ctx.name || "there"},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">Kayla from Studio K Hair Lounge was losing 3-4 clients a week to no-shows. She turned on Rebooked's automated text-backs and recovered 11 of them in month one — without touching her phone once.</p>
    <blockquote style="border-left:3px solid ${brandStyles.teal};padding-left:12px;margin:16px 0;color:#4b5563;font-style:italic;font-size:14px;">
      "We recovered $700 in the first month. I didn't lift a finger."
    </blockquote>
    <p style="color:#374151;font-size:14px;">The best part? She was on a Founder Spot — completely free.</p>
    ${ctaButton("See how it works", "https://rebooked.org")}
  `);
}

function painAmplificationEmail(ctx: Record<string, any>): string {
  const avgValue = ctx.avgValue || 80;
  const noShows = ctx.noShows || 15;
  const monthlyCost = avgValue * noShows;
  return emailWrapper(`
    <h2 style="color:${brandStyles.navy};font-size:20px;margin:0 0 8px;">$${monthlyCost.toLocaleString()} — that's what no-shows cost you monthly</h2>
    <p style="color:#6b7280;font-size:14px;">Hi ${ctx.name || "there"},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">At $${avgValue} per appointment and ${noShows} no-shows a month, you're leaving <strong>$${monthlyCost.toLocaleString()}</strong> on the table. Every month. That's <strong>$${(monthlyCost * 12).toLocaleString()}</strong> a year.</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">Rebooked recovers 40% of those no-shows automatically with a single text sent at exactly the right time.</p>
    ${ctaButton("Stop the bleeding — try free", "https://rebooked.org/login")}
  `);
}

function trialInviteEmail(ctx: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:${brandStyles.navy};font-size:20px;margin:0 0 8px;">35 days. Completely free. No risk.</h2>
    <p style="color:#6b7280;font-size:14px;">Hi ${ctx.name || "there"},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">I built Rebooked because I know how frustrating no-shows are. That's why I made the deal simple:</p>
    <ul style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;">
      <li>Try it free for 35 days</li>
      <li>If you don't see positive ROI, you pay nothing</li>
      <li>No credit card to sign up</li>
      <li>Set up in under 5 minutes</li>
    </ul>
    ${ctaButton("Start your free trial", "https://rebooked.org/login")}
    <p style="color:#6b7280;font-size:13px;text-align:center;">— Brendan, founder of Rebooked</p>
  `);
}

function urgencyEmail(ctx: Record<string, any>): string {
  return emailWrapper(`
    <h2 style="color:${brandStyles.navy};font-size:20px;margin:0 0 8px;">Founder Spots are almost gone</h2>
    <p style="color:#6b7280;font-size:14px;">Hi ${ctx.name || "there"},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">I'm offering 10 Founder Spots — Rebooked completely free, forever. No monthly fee, no revenue share. Full platform access in exchange for your feedback as I build.</p>
    <div style="background:#fef3c7;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center;">
      <span style="font-weight:700;color:${brandStyles.gold};font-size:14px;">Spots are filling fast</span>
    </div>
    <p style="color:#374151;font-size:14px;">Once they're gone, the next tier is $199/month + 15% revenue share (still with the 35-day guarantee).</p>
    ${ctaButton("Claim your Founder Spot", "https://rebooked.org/login")}
  `);
}

function nudgeEmail(ctx: Record<string, any>, step: number): string {
  const messages: Record<number, string> = {
    1: `<p style="color:#374151;font-size:14px;line-height:1.6;">You signed up for Rebooked — nice! But you haven't finished setting up your automations yet.</p>
        <p style="color:#374151;font-size:14px;">It takes about 2 minutes. Choose your automations, and Rebooked starts working for you immediately.</p>`,
    2: `<p style="color:#374151;font-size:14px;line-height:1.6;">Is something blocking you from finishing your Rebooked setup? Reply to this email — I read every one and I'm happy to help.</p>
        <p style="color:#374151;font-size:14px;">If it's a tech thing, I can walk you through it. If it's a timing thing, no worries — your account will be here when you're ready.</p>`,
    3: `<p style="color:#374151;font-size:14px;line-height:1.6;">Your Rebooked account is ready and waiting. All you need to do is pick your automations and you'll start recovering appointments automatically.</p>
        <p style="color:#374151;font-size:14px;">Every week without Rebooked is another week of no-shows walking out the door.</p>`,
  };

  return emailWrapper(`
    <h2 style="color:${brandStyles.navy};font-size:20px;margin:0 0 8px;">${step === 1 ? "You're almost there" : step === 2 ? "Quick question" : "Your setup is waiting"}</h2>
    <p style="color:#6b7280;font-size:14px;">Hi ${ctx.name || "there"},</p>
    ${messages[step] || ""}
    ${ctaButton("Finish setup", "https://rebooked.org/onboarding")}
    <p style="color:#6b7280;font-size:13px;text-align:center;">— Brendan, Rebooked</p>
  `);
}
