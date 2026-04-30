import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Lightweight health check for Railway — no DB query, just returns 200.
 * DB connectivity is checked separately via /api/cron/keep-alive.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", ts: Date.now() });
}
