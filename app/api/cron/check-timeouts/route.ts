import { NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { stellarService } from "@/lib/stellar";

export async function POST() {
  const expired = await databaseService.getExpiredFundedRemittances();
  let processed = 0;
  const errors: string[] = [];

  for (const record of expired) {
    try {
      // Call contract refund — idempotent: if already refunded, contract returns error
      const { txHash } = await stellarService.refundCollateral(record.txId);
      await databaseService.updateStatus(record.txId, "expired");
      await databaseService.updateStellarTxHash(record.txId, txHash);
      processed++;
    } catch (err) {
      // Log and continue — don't let one failure block others
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${record.txId}: ${msg}`);
      console.error(`[cron/check-timeouts] Failed to refund ${record.txId}:`, err);

      // If contract says already processed, still mark as expired in DB
      if (msg.includes("TxAlreadyProcessed") || msg.includes("NotExpired") === false) {
        try {
          await databaseService.updateStatus(record.txId, "expired");
          processed++;
        } catch {
          // ignore
        }
      }
    }
  }

  return NextResponse.json({
    processed,
    total: expired.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// Also allow GET for easy browser/cron trigger
export { POST as GET };
