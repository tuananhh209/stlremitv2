import { NextResponse } from "next/server";
import { db } from "@/lib/db-client";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/keep-alive
 * Pings the Neon DB to prevent cold starts.
 * Call this every 5 minutes via Railway cron or uptime monitor.
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 503 });
  }
}

export { GET as POST };
