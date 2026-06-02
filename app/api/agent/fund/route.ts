import { NextRequest, NextResponse } from "next/server";
import { stellarRpcService } from "@/lib/stellar-rpc";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import type { AgentFundResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/fund
 * Called AFTER the wallet-signed transaction has been submitted on-chain.
 * Queries the contract for the latest balance and syncs it to DB.
 */
import { z } from "zod";

const fundSchema = z.object({
  agentWallet: z.string().min(1, "Agent wallet is required"),
  usdcAmount: z.number().positive("USDC amount must be positive"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = fundSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format(), code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    
    const { usdcAmount, agentWallet } = parsed.data;

    // Query actual on-chain balance (source of truth)
    const { total } = await stellarRpcService.getContractBalance();

    // Sync to DB
    await databaseService.updateAgentCollateral(agentWallet, total);

    const response: AgentFundResponse = {
      newBalance: total,
      stellarTxHash: "", // already submitted by client
    };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
