import { NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";
import { errorResponse } from "@/lib/api-helpers";
import type { AgentBalanceResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { total, available } = await stellarService.getContractBalance();
    const response: AgentBalanceResponse = {
      totalCollateral: total,
      reservedUsdc: total - available,
      availableUsdc: available,
    };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
