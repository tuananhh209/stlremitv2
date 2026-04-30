import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

/**
 * GET /api/migrate
 * One-shot migration endpoint: adds missing enum values and columns
 * to the production database. Safe to run multiple times (IF NOT EXISTS).
 * 
 * DELETE THIS ROUTE after successful migration.
 */
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    // ── Add missing enum values ──────────────────────────────────────────────
    // PostgreSQL doesn't support IF NOT EXISTS for ADD VALUE in all versions,
    // so we check pg_enum first to avoid "already exists" errors.

    const existing = await sql`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'remittance_status')
    `;
    const existingLabels = existing.map((r: any) => r.enumlabel);
    const results: string[] = [];

    if (!existingLabels.includes("cancelled")) {
      await sql`ALTER TYPE "public"."remittance_status" ADD VALUE 'cancelled'`;
      results.push("Added enum: cancelled");
    } else {
      results.push("Enum 'cancelled' already exists");
    }

    if (!existingLabels.includes("payout_submitted")) {
      await sql`ALTER TYPE "public"."remittance_status" ADD VALUE 'payout_submitted'`;
      results.push("Added enum: payout_submitted");
    } else {
      results.push("Enum 'payout_submitted' already exists");
    }

    // ── Add missing columns ──────────────────────────────────────────────────
    const cols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'remittance_requests'
    `;
    const existingCols = cols.map((r: any) => r.column_name);

    for (const col of ["receiver_wallet", "sender_wallet", "sender_name", "agent_wallet"]) {
      if (!existingCols.includes(col)) {
        await sql(`ALTER TABLE "remittance_requests" ADD COLUMN "${col}" text`);
        results.push(`Added column: ${col}`);
      } else {
        results.push(`Column '${col}' already exists`);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
