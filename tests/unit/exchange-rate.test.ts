// Feature: stellar-remittance-mvp, Property 1: Exchange Rate Calculation Correctness
import fc from "fast-check";
import { calculateAmounts, EXCHANGE_RATES } from "@/lib/config";

describe("Exchange Rate Calculation", () => {
  test("Property 1: usdcEquivalent and phpPayout are correct for any positive VND amount", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 1_000_000_000, noNaN: true }),
        (vndAmount) => {
          const { usdcEquivalent, phpPayout } = calculateAmounts(vndAmount);
          const expectedUsdc = vndAmount * EXCHANGE_RATES.VND_TO_USDC;
          const expectedPhp = expectedUsdc * EXCHANGE_RATES.USDC_TO_PHP;

          expect(Math.abs(usdcEquivalent - expectedUsdc)).toBeLessThan(1e-6);
          expect(Math.abs(phpPayout - expectedPhp)).toBeLessThan(1e-3);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("usdcEquivalent is always positive for positive VND", () => {
    fc.assert(
      fc.property(fc.float({ min: Math.fround(0.01), max: Math.fround(1e9), noNaN: true }), (vnd) => {
        const { usdcEquivalent, phpPayout } = calculateAmounts(vnd);
        expect(usdcEquivalent).toBeGreaterThan(0);
        expect(phpPayout).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  test("phpPayout = usdcEquivalent * USDC_TO_PHP rate", () => {
    fc.assert(
      fc.property(fc.float({ min: Math.fround(1), max: Math.fround(1e8), noNaN: true }), (vnd) => {
        const { usdcEquivalent, phpPayout } = calculateAmounts(vnd);
        const expectedPhp = usdcEquivalent * EXCHANGE_RATES.USDC_TO_PHP;
        expect(Math.abs(phpPayout - expectedPhp)).toBeLessThan(1e-6);
      }),
      { numRuns: 100 }
    );
  });
});
