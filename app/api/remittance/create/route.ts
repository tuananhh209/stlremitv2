import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { databaseService } from "@/lib/db";
import { stellarService } from "@/lib/stellar";
import { calculateAmounts } from "@/lib/config";
import { errorResponse } from "@/lib/api-helpers";
import { InsufficientLiquidityError } from "@/lib/errors";
import type { CreateRemittanceResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vndAmount, receiverName, receiverAccount } = body;

    // Validate
    if (!vndAmount || typeof vndAmount !== "number" || vndAmount <= 0) {
      return NextResponse.json(
        { error: "vndAmount must be a positive number", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    if (!receiverName || typeof receiverName !== "string" || !receiverName.trim()) {
      return NextResponse.json(
        { error: "receiverName is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    if (!receiverAccount || typeof receiverAccount !== "string" || !receiverAccount.trim()) {
      return NextResponse.json(
        { error: "receiverAccount is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { usdcEquivalent, phpPayout } = calculateAmounts(vndAmount);

    // Check contract liquidity
    const balance = await stellarService.getContractBalance();
    if (balance.available < usdcEquivalent) {
      throw new InsufficientLiquidityError(usdcEquivalent, balance.available);
    }

    // Generate txId
    const txId = uuidv4();

    // Reserve USDC on-chain (attaches txId as memo)
    const { txHash } = await stellarService.reserveCollateral(txId, usdcEquivalent);

    // Persist to DB
    const record = await databaseService.createRemittance({
      txId,
      vndAmount,
      usdcEquivalent,
      phpPayout,
      receiverName: receiverName.trim(),
      receiverAccount: receiverAccount.trim(),
      stellarTxHash: txHash,
    });

    const response: CreateRemittanceResponse = {
      txId: record.txId,
      usdcEquivalent: record.usdcEquivalent,
      phpPayout: record.phpPayout,
      status: "funded",
      expiresAt: record.expiresAt,
      stellarTxHash: txHash,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
