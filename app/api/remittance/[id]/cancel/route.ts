import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/remittance/[id]/cancel
 * Sender cancels a pending_agent request before agent accepts.
 * No on-chain action needed — USDC not yet locked.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;

    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);

    if (record.status !== "pending_agent") {
      throw new InvalidStatusTransitionError(txId, record.status, "cancel");
    }

    await databaseService.updateStatus(txId, "cancelled");

    return NextResponse.json({ txId, status: "cancelled" });
  } catch (err) {
    return errorResponse(err);
  }
}
