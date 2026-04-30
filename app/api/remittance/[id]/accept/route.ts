import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";
import { EXCHANGE_RATES } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/remittance/[id]/accept
 * Called AFTER agent has signed & submitted the accept tx on-chain.
 * Updates DB: status → funded, expiresAt = now + 300s, stores txHash.
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
    const { stellarTxHash = "", agentWallet = "" } = body;

    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);

    if (record.status !== "pending_agent") {
      throw new InvalidStatusTransitionError(txId, record.status, "accept");
    }

    // Set expiresAt = now + 5 min (payment window starts when agent accepts)
    const updated = await databaseService.acceptRemittance(txId, stellarTxHash, agentWallet);

    return NextResponse.json({
      txId: updated.txId,
      status: updated.status,
      expiresAt: updated.expiresAt,
      stellarTxHash,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
