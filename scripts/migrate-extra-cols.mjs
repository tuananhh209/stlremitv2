import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
const dbUrl = envContent.split("\n").find(l => l.startsWith("DATABASE_URL="))?.replace("DATABASE_URL=", "").trim();
const sql = neon(dbUrl);

async function run(label, query) {
  try {
    await sql.query(query);
    console.log("✓", label);
  } catch (err) {
    if (err.message.includes("already exists") || err.message.includes("duplicate")) {
      console.log("~ already exists:", label);
    } else {
      console.error("✗", label, "→", err.message);
    }
  }
}

// Add missing columns
await run("Add sender_wallet", `ALTER TABLE remittance_requests ADD COLUMN IF NOT EXISTS sender_wallet text`);
await run("Add sender_name",   `ALTER TABLE remittance_requests ADD COLUMN IF NOT EXISTS sender_name text`);
await run("Add agent_wallet",  `ALTER TABLE remittance_requests ADD COLUMN IF NOT EXISTS agent_wallet text`);

// Add cancelled enum value
await run("Add cancelled enum",
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'cancelled'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'remittance_status')
    ) THEN
      ALTER TYPE "remittance_status" ADD VALUE 'cancelled' AFTER 'pending_agent';
    END IF;
  END $$`
);

console.log("\nAll migrations complete!");
