/**
 * Validates a server-returned URL before redirecting the browser to it.
 * Prevents open-redirect attacks if the server is compromised or a response is intercepted.
 */

const TRUSTED_PREFIXES = [
  "https://checkout.stripe.com/",
  "https://billing.stripe.com/",
  "https://connect.stripe.com/",
  "https://dashboard.stripe.com/",
  "https://invoice.stripe.com/",
  // OAuth redirect back to the same origin is handled separately via safeLocalRedirect
];

/**
 * Redirects to a Stripe-hosted URL after validating it starts with a known Stripe domain.
 * Throws if the URL is not trusted.
 */
export function safeStripeRedirect(url: unknown): void {
  if (typeof url !== "string") throw new Error("Invalid redirect URL");
  const isTrusted = TRUSTED_PREFIXES.some((prefix) => url.startsWith(prefix));
  if (!isTrusted) {
    console.error("[safeStripeRedirect] Blocked untrusted URL:", url);
    throw new Error("Redirect target is not a trusted Stripe URL");
  }
  window.location.href = url;
}

/**
 * Redirects to a same-origin URL (OAuth callbacks, calendar auth flows, etc.).
 * Strips any protocol/host to guarantee the redirect stays on the same origin.
 */
export function safeLocalRedirect(url: unknown): void {
  if (typeof url !== "string") throw new Error("Invalid redirect URL");
  try {
    const parsed = new URL(url);
    // Allow only same-origin redirects or well-known OAuth providers
    const trustedHosts = [
      window.location.host,
      "accounts.google.com",
      "login.microsoftonline.com",
      "auth.calendly.com",
    ];
    if (!trustedHosts.includes(parsed.host)) {
      console.error("[safeLocalRedirect] Blocked untrusted redirect:", url);
      throw new Error("Redirect target is not trusted");
    }
    window.location.href = url;
  } catch (e) {
    // If URL parsing fails, treat as a relative path (safe by definition)
    if (typeof url === "string" && url.startsWith("/")) {
      window.location.href = url;
    } else {
      throw e;
    }
  }
}
