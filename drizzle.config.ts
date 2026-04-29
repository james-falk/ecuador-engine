import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// Drizzle CLI doesn't run through Next.js, so load .env.local explicitly
// (Next.js loads it automatically for the app itself).
loadEnv({ path: ".env.local" });
loadEnv(); // .env as fallback

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required (see .env.example)");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
