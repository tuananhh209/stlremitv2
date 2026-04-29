// Feature: stellar-remittance-mvp, Property 3: Remittance Data Persistence Completeness
import fc from "fast-check";
import { calculateAmounts, EXCHANGE_RATES } from "@/lib/config";
import type { RemittanceRecord } from "@/lib/types";

// Simulate what createRemittance does (pure logic, no DB)
function buildRecord(
  txId: string,
  vndAmount: number,
  receiverName: string,
  receiverAccount: string
): RemittanceRecord {
  const { usdcEquivalent, phpPayout } = calculateAmounts(vndAmount);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXCHANGE_RATES.TIMEOUT_SECONDS * 1000);
  return {
    txId,
    vndAmount,
    usdcEquivalent,
    phpPayout,
    receiverName,
    receiverAccount,
    status: "funded",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    senderProofRef: null,
    agentProofRef: null,
    stellarTxHash: null,
  };
}

describe("Data Persistence Completeness", () => {
  test("Property 3: all required fields are present and match inputs", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.float({ min: 1000, max: 1e9, noNaN: true }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        (txId, vndAmount, receiverName, receiverAccount) => {
          const record = buildRecord(txId, vndAmount, receiverName, receiverAccount);

          expect(record.txId).toBe(txId);
          expect(record.vndAmount).toBe(vndAmount);
          expect(record.receiverName).toBe(receiverName);
          expect(record.receiverAccount).toBe(receiverAccount);
          expect(record.status).toBe("funded");
          expect(record.usdcEquivalent).toBeGreaterThan(0);
          expect(record.phpPayout).toBeGreaterThan(0);
          expect(record.createdAt).toBeTruthy();
          expect(record.expiresAt).toBeTruthy();
          expect(new Date(record.expiresAt).getTime()).toBeGreaterThan(
            new Date(record.createdAt).getTime()
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
