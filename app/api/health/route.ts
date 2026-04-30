import { NextResponse } from "next/server";
import { db } from "@/lib/db-client";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Health check endpoint for Railway.
 * Also wakes up Neon DB (prevents cold start on first real request).
 */
export async function GET() {
  try {
    // Ping DB to keep it warm — Neon serverless sleeps after inactivity
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", db: "connected", ts: Date.now() });
  } catch (err) {
    return NextResponse.json(
      { status: "error", db: "disconnected", error: String(err) },
      { status: 503 }
    );
  }
}
