/**
 * Smoke test: DB connectivity and schema verification.
 * Verifies that the Neon PostgreSQL connection works and required tables exist.
 */

import { db } from "@/lib/db-client";
import { remittanceRequests, agentState } from "@/lib/schema";
import { sql } from "drizzle-orm";

const SKIP = !process.env.DATABASE_URL;
const describeOrSkip = SKIP ? describe.skip : describe;

describeOrSkip("DB Connection Smoke Test", () => {
  test("can connect to Neon PostgreSQL", async () => {
    const result = await db.execute(sql`SELECT 1 as ping`);
    expect(result).toBeTruthy();
  }, 15_000);

  test("remittance_requests table exists and is queryable", async () => {
    const rows = await db.select().from(remittanceRequests).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  }, 15_000);

  test("agent_state table exists and is queryable", async () => {
    const rows = await db.select().from(agentState).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  }, 15_000);

  test("remittance_requests has correct columns", async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'remittance_requests'
      ORDER BY ordinal_position
    `);

    const columns = (result as Array<{ column_name: string }>).map(
      (r) => r.column_name
    );

    expect(columns).toContain("tx_id");
    expect(columns).toContain("vnd_amount");
    expect(columns).toContain("usdc_equivalent");
    expect(columns).toContain("php_payout");
    expect(columns).toContain("receiver_name");
    expect(columns).toContain("receiver_account");
    expect(columns).toContain("status");
    expect(columns).toContain("created_at");
    expect(columns).toContain("expires_at");
  }, 15_000);
});
