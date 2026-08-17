import { expect, test } from "@jest/globals";
import {
  calculateAmounts,
  EXCHANGE_RATES,
  InvalidAmountError,
  PLATFORM_SPREAD,
} from "../lib/config";

const PHP_FALLBACK =
  EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_PHP * (1 - PLATFORM_SPREAD);

test("uses live oracle rates when they are usable", () => {
  const { usdcEquivalent, phpPayout } = calculateAmounts(1_000_000, "PHP", {
    USD: 0.00004,
    PHP: 0.0022,
  });

  expect(usdcEquivalent).toBeCloseTo(40, 6);
  expect(phpPayout).toBeCloseTo(2200, 6);
});

test("falls back to configured rates when a live rate is unusable", () => {
  const fromNaN = calculateAmounts(1_000_000, "PHP", { USD: NaN, PHP: NaN });
  const fromMissing = calculateAmounts(1_000_000, "PHP");
  const fromNegative = calculateAmounts(1_000_000, "PHP", { USD: -1, PHP: 0 });

  for (const result of [fromNaN, fromMissing, fromNegative]) {
    expect(result.usdcEquivalent).toBeCloseTo(1_000_000 * EXCHANGE_RATES.VND_TO_USDC, 6);
    expect(result.phpPayout).toBeCloseTo(1_000_000 * PHP_FALLBACK, 6);
    expect(Number.isFinite(result.usdcEquivalent)).toBe(true);
    expect(Number.isFinite(result.phpPayout)).toBe(true);
  }
});

test("rejects amounts that are not positive numbers", () => {
  expect(() => calculateAmounts(0)).toThrow(InvalidAmountError);
  expect(() => calculateAmounts(-100)).toThrow(InvalidAmountError);
  expect(() => calculateAmounts(NaN)).toThrow(InvalidAmountError);
  expect(() => calculateAmounts(Infinity)).toThrow("positive number");
});
