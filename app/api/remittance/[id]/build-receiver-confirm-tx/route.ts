import { NextRequest, NextResponse } from "next/server";
import { stellarBuilderService } from "@/lib/stellar-builder";
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
    const body = await req.json();
    const { receiverPublicKey } = body;

    if (!receiverPublicKey) {
      return NextResponse.json(
        { error: "receiverPublicKey is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);

    if (record.status !== "payout_submitted") {
      throw new InvalidStatusTransitionError(txId, record.status, "confirm");
    }

    if (record.receiverWallet !== receiverPublicKey) {
      return NextResponse.json(
        { error: "Only the designated receiver can confirm this transaction", code: "UNAUTHORIZED" },
        { status: 403 }
      );
    }

    const xdr = await stellarBuilderService.buildReceiverConfirmTx(receiverPublicKey, txId);
    
    return NextResponse.json({ xdr, phpAmount: record.phpPayout });
  } catch (err) {
    return errorResponse(err);
  }
}
