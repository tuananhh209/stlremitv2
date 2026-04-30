import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { stellarService } from "@/lib/stellar";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";

/**
 * POST /api/remittance/[id]/accept
 * Agent accepts a pending_agent request:
 *  1. Locks USDC in smart contract (reserve)
 *  2. Sets status → "funded", resets expiresAt to now+300s
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
      throw new InvalidStatusTransitionError(txId, record.status, "accept");
    }

    // Lock USDC on-chain
    const { txHash } = await stellarService.reserveCollateral(txId, record.usdcEquivalent);

    // Update DB: status → funded, expiresAt = now + 300s
    const updated = await databaseService.acceptRemittance(txId, txHash);

    return NextResponse.json({
      txId: updated.txId,
      status: updated.status,
      expiresAt: updated.expiresAt,
      stellarTxHash: txHash,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
