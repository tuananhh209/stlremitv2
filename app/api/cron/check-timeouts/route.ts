import { NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { stellarService } from "@/lib/stellar";

export const dynamic = "force-dynamic";

export async function POST() {
  const expired = await databaseService.getExpiredActiveRemittances();
  let processed = 0;
  const errors: string[] = [];

  for (const record of expired) {
    try {
      // refund() on new contract: anyone can call, returns USDC to original agent
      const { txHash } = await stellarService.refundCollateral(record.txId);
      await databaseService.updateStatus(record.txId, "expired");
      await databaseService.updateStellarTxHash(record.txId, txHash);
      processed++;
      console.log(`[cron] Refunded ${record.txId} → ${txHash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${record.txId}: ${msg}`);
      console.error(`[cron] Failed to refund ${record.txId}:`, msg);

      // If contract already processed (TxAlreadyProcessed) → just mark DB
      if (
        msg.includes("TxAlreadyProcessed") ||
        msg.includes("Expired") ||
        msg.includes("SIMULATION_FAILED")
      ) {
        try {
          await databaseService.updateStatus(record.txId, "expired");
          processed++;
        } catch { /* ignore */ }
      }
    }
  }

  return NextResponse.json({ processed, total: expired.length, errors: errors.length ? errors : undefined });
}

export { POST as GET };
