import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { ENV } from "./env";

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Marketing emails get List-Unsubscribe, Precedence:bulk, and a personal from-address.
   *  Transactional emails (default) get priority delivery and no unsubscribe headers. */
  type?: "transactional" | "marketing";
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}

/** Check the suppression list before sending. Returns true if the email should be skipped. */
async function isSuppressed(email: string): Promise<boolean> {
  try {
    // Lazy-import to avoid circular dependency with db module
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return false;
    const { sql } = await import("drizzle-orm");
    const rows = await db.execute(
      sql`SELECT 1 FROM email_suppression_list WHERE email = ${email} LIMIT 1`,
    );
    const results = Array.isArray(rows) ? rows[0] : rows;
    return Array.isArray(results) && results.length > 0;
  } catch {
    // Table may not exist yet; don't block sending
    return false;
  }
}

/** Build headers appropriate for the email type */
function buildHeaders(to: string, type: "transactional" | "marketing") {
  const messageId = `<${randomUUID()}@rebooked.org>`;
  const base: Record<string, string> = {
    "Message-ID": messageId,
    "X-Mailer": "Rebooked/1.0",
  };

  if (type === "marketing") {
    const unsubUrl = `${ENV.backendUrl}/api/email/unsubscribe?email=${encodeURIComponent(to)}`;
    base["List-Unsubscribe"] = `<mailto:unsubscribe@rebooked.org>, <${unsubUrl}>`;
    base["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    base["Precedence"] = "bulk";
  }

  return base;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const type = options.type || "transactional";

  // Check suppression list
  if (await isSuppressed(options.to)) {
    console.log(`[Email] Skipped suppressed address: ${options.to}`);
    return { success: false, error: "email_suppressed" };
  }

  const fromAddress =
    type === "marketing"
      ? (process.env.EMAIL_MARKETING_FROM || "aman@rebooked.org")
      : (ENV.emailFromAddress || "noreply@rebooked.org");

  const fromName = type === "marketing" ? "Aman from Rebooked" : "Rebooked";
  const headers = buildHeaders(options.to, type);

  if (smtpConfigured()) {
    try {
      const smtpHost = process.env.SMTP_HOST!;
      const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
      const isLocalhost = smtpHost === "localhost" || smtpHost === "127.0.0.1";

      // DKIM signing (optional — set DKIM_PRIVATE_KEY env var)
      const dkimConfig = process.env.DKIM_PRIVATE_KEY
        ? {
            dkim: {
              domainName: "rebooked.org",
              keySelector: process.env.DKIM_SELECTOR || "mail",
              privateKey: process.env.DKIM_PRIVATE_KEY,
            },
          }
        : {};

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === "true",
        ...(isLocalhost ? { ignoreTLS: true } : {}),
        ...(!isLocalhost
          ? {
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS || "",
              },
            }
          : {}),
        tls: { rejectUnauthorized: process.env.NODE_ENV === "production" && !isLocalhost },
        ...dkimConfig,
      });

      await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text,
        headers,
        envelope: {
          from: `bounces@rebooked.org`,
          to: options.to,
        },
      });

      console.log(`[Email] SMTP sent to ${options.to} subject=${options.subject}`);
      return { success: true };
    } catch (error) {
      console.error("[Email] SMTP failed:", error);
      return { success: false, error: String(error) };
    }
  }

  const sendGridKey = ENV.sendGridApiKey;
  if (!sendGridKey) {
    console.warn(`[Email] No SMTP or SendGrid configured, skipping email to ${options.to}.`);
    return { success: false, error: "Email not configured (set SMTP_* or SENDGRID_API_KEY)" };
  }

  try {
    const body = {
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: fromAddress, name: fromName },
      subject: options.subject,
      content: [
        { type: "text/plain", value: options.text },
        { type: "text/html", value: options.html || options.text },
      ],
      headers,
    };

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendGridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Email] SendGrid returned", response.status, errorBody);
      return { success: false, error: `SendGrid ${response.status}` };
    }

    console.log(`[Email] Sent to ${options.to} subject=${options.subject}`);
    return { success: true };
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Consistent HTML wrapper for transactional emails (verification, password reset, invitations).
 * Does NOT include unsubscribe links — these are legally required messages.
 */
export function transactionalWrapper(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:20px;font-weight:700;color:#0D1B2A;letter-spacing:-0.5px;">Rebooked</span>
    </div>
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      ${bodyHtml}
    </div>
    <div style="text-align:center;margin-top:24px;font-size:12px;color:#9ca3af;">
      <p>Rebooked &middot; rebooked.org</p>
    </div>
  </div>
</body>
</html>`;
}
