import { NextRequest, NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/remittance/[id]/build-receiver-confirm-tx
 * Build unsigned XDR for receiver to confirm they received PHP.
 * Signing this releases USDC back to agent.
 *
 * Body: { receiverPublicKey: string }
 * Returns: { xdr: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;
    const { receiverPublicKey } = await req.json();

    if (!receiverPublicKey) {
      return NextResponse.json(
        { error: "receiverPublicKey is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);

    if (record.status !== "processing" && record.status !== "payout_submitted") {
      throw new InvalidStatusTransitionError(txId, record.status, "receiver-confirm");
    }

    const xdr = await stellarService.buildReceiverConfirmTx(receiverPublicKey, txId);
    return NextResponse.json({ xdr });
  } catch (err) {
    return errorResponse(err);
  }
}
