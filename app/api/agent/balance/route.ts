import { NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";
import { errorResponse } from "@/lib/api-helpers";
import type { AgentBalanceResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { total } = await stellarService.getContractBalance();
    const reserved = await databaseService.getReservedUsdc();
    const historicalVolume = await databaseService.getHistoricalVolume();
    
    const response: AgentBalanceResponse = {
      totalCollateral: total,
      reservedUsdc: reserved,
      availableUsdc: Math.max(0, total - reserved),
      historicalVolume,
    };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
