import "dotenv/config";
import { getDb } from "../db";
import { plans } from "../../drizzle/schema";

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Database unavailable. Set DATABASE_URL and ensure DB is reachable.");
    process.exit(1);
  }

  // V2 Pricing: Single plan $199/month + 15% revenue share
  // Early adopter program: First 20 clients get risk-free trial
  const priceId = process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRICE_SCALE || null;
  const earlyAdopterPriceId = process.env.STRIPE_PRICE_EARLY_ADOPTER || null;

  const items = [
    {
      name: "Early Adopter",
      slug: "early-adopter",
      priceMonthly: 0, // Free if ROI is negative (risk-free guarantee)
      maxAutomations: 9999,
      maxMessages: 999999,
      maxSeats: 10,
      features: [
        "Full platform access",
        "AI-powered SMS re-engagement",
        "No-show recovery automation",
        "Cancellation recovery campaigns",
        "Revenue analytics dashboard",
        "Multi-channel messaging (SMS + email)",
        "Industry-specific templates",
        "TCPA compliance built-in",
        "ROI guarantee — FREE if platform doesn't generate positive ROI",
        "15% revenue share on recovered revenue",
        "Priority onboarding support",
        "Early adopter pricing locked in forever",
      ],
      stripePriceId: earlyAdopterPriceId,
    },
    {
      name: "Pro",
      slug: "pro",
      priceMonthly: 19900, // $199/month in cents
      maxAutomations: 9999,
      maxMessages: 999999,
      maxSeats: 10,
      features: [
        "Full platform access",
        "AI-powered SMS re-engagement",
        "No-show recovery automation",
        "Cancellation recovery campaigns",
        "Revenue analytics dashboard",
        "Multi-channel messaging (SMS + email)",
        "Industry-specific templates",
        "TCPA compliance built-in",
        "A/B testing for message optimization",
        "Waitlist management & cancellation filling",
        "Review generation automation",
        "Post-appointment follow-up sequences",
        "15% revenue share on recovered revenue",
        "Advanced reporting & custom insights",
        "Priority support",
      ],
      stripePriceId: priceId,
    },
  ];

  for (const p of items) {
    try {
      await db
        .insert(plans)
        .values(p)
        .onDuplicateKeyUpdate({
          set: {
            name: p.name,
            priceMonthly: p.priceMonthly,
            maxAutomations: p.maxAutomations,
            maxMessages: p.maxMessages,
            maxSeats: p.maxSeats,
            features: p.features,
            stripePriceId: p.stripePriceId,
          },
        });
      console.log(`Upserted plan: ${p.slug} ($${(p.priceMonthly / 100).toFixed(0)}/month)`);
    } catch (err) {
      console.error(`Failed to upsert plan ${p.slug}:`, err);
    }
  }

  console.log("\n✅ V2 Plans seed complete");
  console.log("   - Early Adopter: FREE (risk-free, first 20 clients) + 15% revenue share");
  console.log("   - Pro: $199/month + 15% revenue share on recovered revenue");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
