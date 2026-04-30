import { NextResponse } from "next/server";
import { db } from "@/lib/db-client";
import { userProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/profile
 * Returns the agent's bank info (agentBankName, agentAccountNumber, etc.)
 * Used by the tx page to show payment details to senders.
 * Agent is identified by role = "agent" — returns the first agent profile found.
 */
export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.role, "agent"))
      .limit(1);

    if (!row) return NextResponse.json(null);
    return NextResponse.json(row);
  } catch (err) {
    return errorResponse(err);
  }
}
