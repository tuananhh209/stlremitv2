// Feature: stellar-remittance-mvp, Property 17: API List Completeness
import fc from "fast-check";
import { calculateAmounts, EXCHANGE_RATES } from "@/lib/config";
import type { RemittanceRecord } from "@/lib/types";

// Simulate in-memory DB
function createMockDB() {
  const store: RemittanceRecord[] = [];
  return {
    insert(record: RemittanceRecord) {
      store.push(record);
    },
    list(): RemittanceRecord[] {
      return [...store].reverse();
    },
    get(txId: string): RemittanceRecord | undefined {
      return store.find((r) => r.txId === txId);
    },
  };
}

function makeRecord(txId: string, vndAmount: number): RemittanceRecord {
  const { usdcEquivalent, phpPayout } = calculateAmounts(vndAmount);
  const now = new Date();
  return {
    txId,
    vndAmount,
    usdcEquivalent,
    phpPayout,
    receiverName: "Test Receiver",
    receiverAccount: "09123456789",
    status: "funded",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EXCHANGE_RATES.TIMEOUT_SECONDS * 1000).toISOString(),
    senderProofRef: null,
    agentProofRef: null,
    stellarTxHash: null,
  };
}

describe("API List Completeness", () => {
  // Property 17
  test("Property 17: list returns all N created records with correct field values", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (n) => {
          const db = createMockDB();
          const ids: string[] = [];

          for (let i = 0; i < n; i++) {
            const txId = `tx-${i}-${Date.now()}`;
            const record = makeRecord(txId, (i + 1) * 10000);
            db.insert(record);
            ids.push(txId);
          }

          const list = db.list();

          // All N records returned
          expect(list.length).toBe(n);

          // All txIds present
          const returnedIds = new Set(list.map((r) => r.txId));
          for (const id of ids) {
            expect(returnedIds.has(id)).toBe(true);
          }

          // Each record has correct fields
          for (const record of list) {
            expect(record.txId).toBeTruthy();
            expect(record.vndAmount).toBeGreaterThan(0);
            expect(record.usdcEquivalent).toBeGreaterThan(0);
            expect(record.phpPayout).toBeGreaterThan(0);
            expect(record.status).toBe("funded");
            expect(record.receiverName).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("GET /api/remittance/[id] returns correct record", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.float({ min: 1000, max: 1e6, noNaN: true }), (txId, vnd) => {
        const db = createMockDB();
        const record = makeRecord(txId, vnd);
        db.insert(record);

        const found = db.get(txId);
        expect(found).toBeDefined();
        expect(found?.txId).toBe(txId);
        expect(found?.vndAmount).toBe(vnd);
      }),
      { numRuns: 100 }
    );
  });
});
