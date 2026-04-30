import { NextRequest, NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import type { AgentFundResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/fund
 * Called AFTER the wallet-signed transaction has been submitted on-chain.
 * Queries the contract for the latest balance and syncs it to DB.
 */
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

    // Query actual on-chain balance (source of truth)
    const { total } = await stellarService.getContractBalance();

    // Sync to DB
    await databaseService.updateAgentCollateral(total);

    const response: AgentFundResponse = {
      newBalance: total,
      stellarTxHash: "", // already submitted by client
    };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
