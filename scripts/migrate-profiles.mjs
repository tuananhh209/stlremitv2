import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
const dbUrl = envContent
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  ?.replace("DATABASE_URL=", "")
  .trim();

if (!dbUrl) { console.error("DATABASE_URL not found"); process.exit(1); }

const sql = neon(dbUrl);

async function run(label, query) {
  try {
    await sql.query(query);
    console.log("✓", label);
  } catch (err) {
    // Ignore "already exists" errors
    if (err.message.includes("already exists") || err.message.includes("duplicate")) {
      console.log("~ already exists:", label);
    } else {
      console.error("✗", label, "→", err.message);
    }
  }
}

await run("Add pending_agent enum value",
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'pending_agent'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'remittance_status')
    ) THEN
      ALTER TYPE "remittance_status" ADD VALUE 'pending_agent' BEFORE 'funded';
    END IF;
  END $$`
);

await run("Create user_profiles table",
  `CREATE TABLE IF NOT EXISTS "user_profiles" (
    "wallet_address" text PRIMARY KEY NOT NULL,
    "role" text NOT NULL,
    "bank_name" text,
    "account_number" text,
    "account_holder" text,
    "qr_image_url" text,
    "agent_bank_name" text,
    "agent_account_number" text,
    "agent_account_holder" text,
    "agent_qr_image_url" text,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`
);

console.log("\nMigration complete!");
