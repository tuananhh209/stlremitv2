import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
const dbUrl = envContent.split("\n").find(l => l.startsWith("DATABASE_URL="))?.replace("DATABASE_URL=", "").trim();
const sql = neon(dbUrl);

// Run each separately with fresh connection
try {
  await sql`ALTER TABLE remittance_requests ADD COLUMN IF NOT EXISTS sender_name text`;
  console.log("✓ sender_name");
} catch(e) { console.log("sender_name:", e.message); }

try {
  await sql`ALTER TABLE remittance_requests ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone`;
  console.log("✓ cancelled_at (optional)");
} catch(e) { /* ignore */ }

console.log("Done");
