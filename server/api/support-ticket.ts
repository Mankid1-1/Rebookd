/**
 * Support Ticket API — receives contact form submissions from /support
 * Sends an email to the support inbox and stores in system logs.
 */

import type { Express } from "express";
import { logger } from "../_core/logger";

export function registerSupportTicketEndpoint(app: Express) {
  app.post("/api/support-ticket", async (req, res) => {
    try {
      const { name, email, category, message } = req.body ?? {};

      if (!email || !message) {
        return res.status(400).json({ error: "Email and message are required" });
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      // Rate limit: max 5 per IP per hour (simple in-memory)
      const ip = req.ip || req.socket?.remoteAddress || "unknown";
      const key = `support:${ip}`;
      const now = Date.now();
      if (!rateBucket.has(key)) rateBucket.set(key, []);
      const bucket = rateBucket.get(key)!;
      const recent = bucket.filter((t) => now - t < 3_600_000);
      if (recent.length >= 5) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
      recent.push(now);
      rateBucket.set(key, recent);

      logger.info("Support ticket received", {
        email,
        name: name || "Anonymous",
        category: category || "general",
        messageLength: message.length,
        ip,
      });

      // Try sending email notification
      try {
        const { EmailService } = await import("../services/email.service");
        await EmailService.sendEmail({
          to: "rebooked@rebooked.org",
          subject: `Support: [${category || "general"}] from ${name || email}`,
          text: `Name: ${name || "Not provided"}\nEmail: ${email}\nCategory: ${category || "general"}\n\nMessage:\n${message}`,
          html: `<div style="font-family:sans-serif;max-width:600px;padding:20px">
            <h2 style="color:#0D1B2A">New Support Request</h2>
            <p><strong>From:</strong> ${name || "Not provided"} (${email})</p>
            <p><strong>Category:</strong> ${category || "general"}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
            <p style="white-space:pre-wrap">${message}</p>
          </div>`,
        });
      } catch {
        logger.warn("Failed to send support ticket email notification");
      }

      return res.json({ success: true });
    } catch (err) {
      logger.error("Support ticket endpoint error", { error: String(err) });
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}

// Simple in-memory rate limiter
const rateBucket = new Map<string, number[]>();

// Clean up stale entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [key, times] of rateBucket) {
    const filtered = times.filter((t) => t > cutoff);
    if (filtered.length === 0) rateBucket.delete(key);
    else rateBucket.set(key, filtered);
  }
}, 600_000).unref();
