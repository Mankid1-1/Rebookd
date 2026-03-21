import "dotenv/config";
import { getDb } from "../db";
import { plans } from "../../drizzle/schema";

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Database unavailable. Set DATABASE_URL and ensure DB is reachable.");
    process.exit(1);
  }

  const starterPriceId = process.env.STRIPE_PRICE_STARTER || null;
  const growthPriceId = process.env.STRIPE_PRICE_GROWTH || null;
  const scalePriceId = process.env.STRIPE_PRICE_SCALE || null;

  const items = [
    {
      name: "Starter",
      slug: "starter",
      priceMonthly: 4900,
      maxAutomations: 3,
      maxMessages: 500,
      maxSeats: 1,
      features: ["AI rewrite", "Basic automations"],
      stripePriceId: starterPriceId,
    },
    {
      name: "Growth",
      slug: "growth",
      priceMonthly: 9900,
      maxAutomations: 10,
      maxMessages: 2500,
      maxSeats: 3,
      features: ["Everything in Starter", "Advanced automations", "Priority support"],
      stripePriceId: growthPriceId,
    },
    {
      name: "Scale",
      slug: "scale",
      priceMonthly: 19900,
      maxAutomations: 9999,
      maxMessages: 999999,
      maxSeats: 10,
      features: ["Enterprise support", "Custom integrations"],
      stripePriceId: scalePriceId,
    },
  ];

  for (const p of items) {
    try {
      await db
        .insert(plans)
        .values(p)
        .onDuplicateKeyUpdate({ set: { name: p.name, priceMonthly: p.priceMonthly, maxAutomations: p.maxAutomations, maxMessages: p.maxMessages, maxSeats: p.maxSeats, features: p.features, stripePriceId: p.stripePriceId } });
      console.log(`Upserted plan: ${p.slug}`);
    } catch (err) {
      console.error(`Failed to upsert plan ${p.slug}:`, err);
    }
  }

  console.log("Plans seed complete");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
