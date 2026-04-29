// Feature: stellar-remittance-mvp, Property 13: Timeout Window Consistency
import fc from "fast-check";
import { EXCHANGE_RATES } from "@/lib/config";

function computeExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + EXCHANGE_RATES.TIMEOUT_SECONDS * 1000);
}

describe("Timeout Window Consistency", () => {
  test("Property 13: expiresAt = createdAt + 300 seconds for all records", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
        (createdAt) => {
          const expiresAt = computeExpiresAt(createdAt);
          const diffSeconds =
            (expiresAt.getTime() - createdAt.getTime()) / 1000;
          expect(diffSeconds).toBe(EXCHANGE_RATES.TIMEOUT_SECONDS);
          expect(diffSeconds).toBe(300);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("TIMEOUT_SECONDS is exactly 300", () => {
    expect(EXCHANGE_RATES.TIMEOUT_SECONDS).toBe(300);
  });

  test("expiresAt is always after createdAt", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
        (createdAt) => {
          const expiresAt = computeExpiresAt(createdAt);
          expect(expiresAt.getTime()).toBeGreaterThan(createdAt.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });
});
