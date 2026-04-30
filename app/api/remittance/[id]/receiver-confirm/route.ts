import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/remittance/[id]/receiver-confirm
 * Called AFTER receiver signed & submitted receiver_confirm tx on-chain.
 * Updates DB: status → completed, stores txHash.
 *
 * Body: { stellarTxHash: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;
    const body = await req.json().catch(() => ({}));
    const stellarTxHash: string = body.stellarTxHash ?? "";

    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);

    if (record.status !== "processing" && record.status !== "payout_submitted") {
      throw new InvalidStatusTransitionError(txId, record.status, "receiver-confirm");
    }

    await databaseService.updateStatus(txId, "completed");
    if (stellarTxHash) {
      await databaseService.updateStellarTxHash(txId, stellarTxHash);
    }

    return NextResponse.json({ txId, status: "completed", stellarTxHash });
  } catch (err) {
    return errorResponse(err);
  }
}
