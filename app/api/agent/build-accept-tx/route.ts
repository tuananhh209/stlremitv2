import { NextRequest, NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";

/**
 * POST /api/agent/build-accept-tx
 * Build an unsigned XDR transaction for agent to accept a remittance request.
 * The tx calls escrow.accept(agent, tx_id, amount, receiver_wallet).
 *
 * Body: { txId: string, agentPublicKey: string }
 * Returns: { xdr: string, usdcAmount: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { txId, agentPublicKey } = await req.json();

    if (!txId || !agentPublicKey) {
      return NextResponse.json(
        { error: "txId and agentPublicKey are required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);

    if (record.status !== "pending_agent") {
      throw new InvalidStatusTransitionError(txId, record.status, "accept");
    }

    // Get receiver's wallet address from their profile
    const receiverWallet = await databaseService.getReceiverWallet(record.receiverAccount);

    const xdr = await stellarService.buildAcceptTx(
      agentPublicKey,
      txId,
      record.usdcEquivalent,
      receiverWallet ?? agentPublicKey, // fallback if receiver has no wallet yet
    );

    return NextResponse.json({ xdr, usdcAmount: record.usdcEquivalent });
  } catch (err) {
    return errorResponse(err);
  }
}
