import { NextRequest, NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";

export const dynamic = "force-dynamic";

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

    // receiverWallet is stored directly on the remittance record (set by sender)
    const receiverWallet = record.receiverWallet;
    if (!receiverWallet) {
      return NextResponse.json(
        { error: "Receiver wallet address not set on this remittance", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const xdr = await stellarService.buildAcceptTx(
      agentPublicKey,
      txId,
      record.usdcEquivalent,
      receiverWallet,
    );

    return NextResponse.json({ xdr, usdcAmount: record.usdcEquivalent });
  } catch (err) {
    return errorResponse(err);
  }
}
