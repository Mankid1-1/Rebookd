import "dotenv/config";
import { getDb } from "../db";
import { plans } from "../../drizzle/schema";

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Database unavailable. Set DATABASE_URL and ensure DB is reachable.");
    process.exit(1);
  }

  const rebookedPriceId = process.env.STRIPE_PRICE_REBOOKED || null;
  const flexPriceId = process.env.STRIPE_PRICE_FLEX || null;

  const items = [
    {
      name: "Flex",
      slug: "flex",
      priceMonthly: 2900,
      maxAutomations: 3,
      maxMessages: 500,
      maxSeats: 1,
      revenueSharePercent: 20,
      hasPromotion: true,
      promotionalSlots: 10,
      features: ["Basic automations", "SMS messaging", "Lead management"],
      stripePriceId: flexPriceId,
    },
    {
      name: "Rebooked",
      slug: "rebooked",
      priceMonthly: 19900,
      maxAutomations: 9999,
      maxMessages: 999999,
      maxSeats: 10,
      revenueSharePercent: 15,
      hasPromotion: true,
      promotionalSlots: 20,
      features: ["Unlimited automations", "AI rewrite", "Priority support", "Team members", "Advanced analytics"],
      stripePriceId: rebookedPriceId,
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
            revenueSharePercent: p.revenueSharePercent,
            features: p.features,
            stripePriceId: p.stripePriceId,
          },
        });
      console.log(`Upserted plan: ${p.slug}`);
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
