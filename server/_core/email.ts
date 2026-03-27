import nodemailer from "nodemailer";
import { ENV } from "./env";

export interface EmailResult {
  success: boolean;
  error?: string;
}

function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}

export async function sendEmail(options: { to: string; subject: string; text: string; html?: string }): Promise<EmailResult> {
  const fromAddress = ENV.emailFromAddress || "noreply@rebooked.org";

  if (smtpConfigured()) {
    try {
      const smtpHost = process.env.SMTP_HOST!;
      const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
      const isLocalhost = smtpHost === "localhost" || smtpHost === "127.0.0.1";
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === "true",
        // For localhost mail servers, skip TLS negotiation entirely
        ...(isLocalhost ? { ignoreTLS: true } : {}),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || "",
        },
        tls: { rejectUnauthorized: false },
      });
      await transporter.sendMail({
        from: `"Rebooked" <${fromAddress}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text,
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
      from: { email: fromAddress, name: "Rebooked" },
      subject: options.subject,
      content: [
        { type: "text/plain", value: options.text },
        { type: "text/html", value: options.html || options.text },
      ],
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
