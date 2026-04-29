import { NextRequest, NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import type { AgentFundResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { usdcAmount } = body;

    if (!usdcAmount || typeof usdcAmount !== "number" || usdcAmount <= 0) {
      return NextResponse.json(
        { error: "usdcAmount must be a positive number", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Fund contract on-chain
    const { txHash, newBalance } = await stellarService.fundContract(usdcAmount);

    // Update DB agent state
    await databaseService.updateAgentCollateral(newBalance);

    const response: AgentFundResponse = { newBalance, stellarTxHash: txHash };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
