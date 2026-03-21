import { ENV } from "./env";

export interface EmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(options: { to: string; subject: string; text: string; html?: string }): Promise<EmailResult> {
  const sendGridKey = ENV.sendGridApiKey;
  const fromAddress = ENV.emailFromAddress || "hello@rebookd.com";

  if (!sendGridKey) {
    console.warn(`[Email] SendGrid API key not configured, skipping email to ${options.to}.`);
    return { success: true };
  }

  try {
    const body = {
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: fromAddress, name: "Rebookd" },
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
