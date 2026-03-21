import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ quiet: true }); // load .env before reading process.env

const connectionString = process.env.DATABASE_URL ?? process.env.RAILWAY_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or RAILWAY_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString.includes("?") ? connectionString : `${connectionString}?ssl={"rejectUnauthorized":false}`,
  },
});
