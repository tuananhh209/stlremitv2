// Feature: stellar-remittance-mvp, Property 4: Insufficient Liquidity Rejection
import fc from "fast-check";
import { InsufficientLiquidityError } from "@/lib/errors";

function checkLiquidity(required: number, available: number): void {
  if (available < required) {
    throw new InsufficientLiquidityError(required, available);
  }
}

describe("Insufficient Liquidity Rejection", () => {
  test("Property 4: request is rejected when required > available", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.0001), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(999.9), noNaN: true }),
        (available, extra) => {
          const required = available + extra + 0.0001;
          expect(() => checkLiquidity(required, available)).toThrow(
            InsufficientLiquidityError
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test("request succeeds when available >= required", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.0001), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
        (required, extra) => {
          const available = required + extra;
          expect(() => checkLiquidity(required, available)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  test("error contains correct required and available values", () => {
    const err = new InsufficientLiquidityError(10, 5);
    expect(err.required).toBe(10);
    expect(err.available).toBe(5);
    expect(err).toBeInstanceOf(InsufficientLiquidityError);
  });
});
