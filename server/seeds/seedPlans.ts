import "dotenv/config";
import { getDb } from "../db";
import { plans } from "../../drizzle/schema";

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Database unavailable. Set DATABASE_URL and ensure DB is reachable.");
    process.exit(1);
  }

  const items = [
    {
      name: "Founder Spots",
      slug: "founder",
      priceMonthly: 0,
      maxAutomations: 9999,
      maxMessages: 999999,
      maxSeats: 10,
      revenueSharePercent: 0,
      hasPromotion: true,
      promotionalSlots: 10,
      features: [
        "Full platform access — forever",
        "All 19 automations",
        "Unlimited SMS",
        "Real-time analytics",
        "No revenue share",
        "No monthly fee — ever",
        "In exchange for honest feedback",
      ],
      stripePriceId: process.env.STRIPE_FOUNDER_PRICE_ID || "price_1THU69PJnVwFKTtaqluytnpJ",
      stripeProductId: process.env.STRIPE_FOUNDER_PRODUCT_ID || "prod_UG06wDViOhpNlc",
    },
    {
      name: "Flex Spots",
      slug: "flex",
      priceMonthly: 19900,
      maxAutomations: 9999,
      maxMessages: 999999,
      maxSeats: 10,
      revenueSharePercent: 15,
      hasPromotion: true,
      promotionalSlots: 10,
      features: [
        "Full platform — free for 35 days",
        "All 19 automations",
        "Unlimited SMS during trial",
        "Real-time analytics",
        "35-day ROI guarantee",
        "No ROI = you owe nothing",
        "Positive ROI = $199/mo + 15% share",
      ],
      stripePriceId: process.env.STRIPE_FLEX_PRICE_ID || "price_1TFe9OPJnVwFKTtaW1lQQKrL",
      stripeProductId: process.env.STRIPE_FLEX_PRODUCT_ID || "prod_UE6MDIJfGfjOsv",
    },
    {
      name: "Enterprise",
      slug: "enterprise",
      priceMonthly: 0, // Custom pricing
      maxAutomations: 9999,
      maxMessages: 999999,
      maxSeats: 999,
      revenueSharePercent: 0, // Negotiated per client
      hasPromotion: false,
      promotionalSlots: 0,
      features: [
        "Everything in Flex Spots",
        "Custom integrations",
        "Dedicated account manager",
        "SLA guarantee",
        "Custom revenue share",
        "White-label options",
        "Unlimited users",
      ],
      stripePriceId: null,
      stripeProductId: process.env.STRIPE_ENTERPRISE_PRODUCT_ID || "prod_UG06w3LBqB1eFz",
    },
  ];

  for (const p of items) {
    try {
      await db
        .insert(plans)
        .values({ ...p, maxUsers: (p as any).maxSeats } as any)
        .onDuplicateKeyUpdate({
          set: {
            name: p.name,
            priceMonthly: p.priceMonthly,
            maxAutomations: p.maxAutomations,
            maxMessages: p.maxMessages,
            maxUsers: (p as any).maxSeats,
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

  console.log("\n✅ Plans seed complete — synced with Stripe 2026-04-01");
  console.log("   - Founder Spots: $0/forever (10 spots, no revenue share)");
  console.log("   - Flex Spots: $0 for 35 days, then $199/mo + 15% revenue share");
  console.log("   - Enterprise: Custom pricing (contact us)");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
