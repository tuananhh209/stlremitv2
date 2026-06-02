import { NextRequest, NextResponse } from "next/server";
import { stellarRpcService } from "@/lib/stellar-rpc";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import type { AgentBalanceResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

// In-memory cache — avoids hitting Stellar RPC on every poll
let cachedBalance: { total: number; ts: number } | null = null;
const CACHE_TTL_MS = 10_000; // 10s — Stellar RPC is slow, cache is fine

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentWallet = searchParams.get("agentWallet");

    const now = Date.now();

    // Use cached Stellar balance if fresh
    let total = 0;
    if (cachedBalance && now - cachedBalance.ts < CACHE_TTL_MS) {
      total = cachedBalance.total;
    } else {
      try {
        const result = await stellarRpcService.getContractBalance();
        total = result.total;
        cachedBalance = { total, ts: now };
      } catch {
        // If Stellar RPC fails, use last cached value
        total = cachedBalance?.total ?? 0;
      }
    }

    // DB queries are fast (Neon HTTP)
    const [reserved, historicalVolume] = await Promise.all([
      databaseService.getReservedUsdc(agentWallet),
      databaseService.getHistoricalVolume(),
    ]);

    const response: AgentBalanceResponse = {
      totalCollateral: total,
      reservedUsdc: reserved,
      availableUsdc: Math.max(0, total - reserved),
      historicalVolume,
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
