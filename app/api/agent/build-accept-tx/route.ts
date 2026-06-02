import { NextRequest, NextResponse } from "next/server";
import { stellarBuilderService } from "@/lib/stellar-builder";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";

export const dynamic = "force-dynamic";

import { z } from "zod";

const acceptSchema = z.object({
  txId: z.string().min(1, "txId is required"),
  agentPublicKey: z.string().min(1, "agentPublicKey is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format(), code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    
    const { txId, agentPublicKey } = parsed.data;

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

    const xdr = await stellarBuilderService.buildAcceptTx(
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
