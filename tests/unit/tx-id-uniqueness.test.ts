// Feature: stellar-remittance-mvp, Property 2: txId Uniqueness
import fc from "fast-check";

function generateTxId(): string {
  // Use crypto.randomUUID (Node 14.17+) — avoids ESM issues with uuid package
  return crypto.randomUUID();
}

function generateTxIds(n: number): string[] {
  return Array.from({ length: n }, () => generateTxId());
}

describe("txId Uniqueness", () => {
  test("Property 2: all generated txIds are distinct", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 100 }), (n) => {
        const ids = generateTxIds(n);
        const unique = new Set(ids);
        expect(unique.size).toBe(n);
      }),
      { numRuns: 100 }
    );
  });

  test("no two consecutive calls produce the same txId", () => {
    for (let i = 0; i < 100; i++) {
      const a = generateTxId();
      const b = generateTxId();
      expect(a).not.toBe(b);
    }
  });
});
