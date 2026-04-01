import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";

const ADMINS = [
  { email: "rebooked@rebooked.org", name: "Rebooked Admin" },
  { email: "brendan@rebooked.org", name: "Brendan" },
];

const PASSWORD = process.env.ADMIN_SEED_PASSWORD;
if (!PASSWORD || PASSWORD.length < 12) {
  console.error("Set ADMIN_SEED_PASSWORD env var (min 12 chars) before seeding.");
  process.exit(1);
}

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Database unavailable. Set DATABASE_URL and ensure DB is reachable.");
    process.exit(1);
  }

  const saltRounds = parseInt(process.env.PASSWORD_SALT_ROUNDS || "12", 10);
  const passwordHash = await bcrypt.hash(PASSWORD, saltRounds);

  for (const admin of ADMINS) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, admin.email))
      .limit(1);

    if (existing.length > 0) {
      // Update existing user to admin with new password
      await db
        .update(users)
        .set({
          role: "admin",
          passwordHash,
          emailVerifiedAt: new Date(),
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(users.email, admin.email));
      console.log(`Updated existing user to admin: ${admin.email}`);
    } else {
      // Create new admin user
      await db.insert(users).values({
        openId: crypto.randomUUID(),
        name: admin.name,
        email: admin.email,
        loginMethod: "email",
        passwordHash,
        role: "admin",
        accountType: "business",
        emailVerifiedAt: new Date(),
        active: true,
        lastSignedIn: new Date(),
      });
      console.log(`Created admin user: ${admin.email}`);
    }
  }

  console.log("\n✅ Admin users seeded successfully");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
