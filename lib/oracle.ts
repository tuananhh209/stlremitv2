/**
 * Price Oracle — fetches live forex rates from ExchangeRate-API (free tier)
 * Base: USD. Converts to VND-based rates. Caches server-side for 60 seconds.
 * Falls back to hardcoded config rates if oracle is unavailable.
 */

import type { CurrencyCode } from "./config";
import { EXCHANGE_RATES } from "./config";

export const PLATFORM_SPREAD = 0.01; // 1% platform fee added on top of market rate

const ORACLE_URL = "https://api.exchangerate-api.com/v4/latest/USD";
const CACHE_TTL_MS = 60_000; // 60 seconds
const CURRENCY_CODES: CurrencyCode[] = ["PHP", "USD", "CNY", "RUB", "GBP", "EUR"];

export interface OracleRates {
  /** VND-based rates WITH 1% spread applied — use for payout calculations */
  rates: Record<CurrencyCode, number>;
  /** VND-based raw market rates from oracle — use for display */
  rawRates: Record<CurrencyCode, number>;
  spread: number;
  updatedAt: string;
  expiresAt: number;
  source: "oracle" | "fallback";
}

// Module-level server-side cache
let _cache: OracleRates | null = null;

/** Build fallback rates from hardcoded config when oracle is unavailable */
function buildFallback(): OracleRates {
  const rawRates: Record<CurrencyCode, number> = {
    USD: EXCHANGE_RATES.VND_TO_USDC,
    PHP: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_PHP,
    CNY: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_CNY,
    RUB: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_RUB,
    GBP: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_GBP,
    EUR: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_EUR,
  };

  const rates = Object.fromEntries(
    CURRENCY_CODES.map((c) => [c, rawRates[c] * (1 - PLATFORM_SPREAD)])
  ) as Record<CurrencyCode, number>;

  return {
    rates,
    rawRates,
    spread: PLATFORM_SPREAD,
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + CACHE_TTL_MS,
    source: "fallback",
  };
}

/**
 * Get live VND-based exchange rates.
 * Server-side only — never call from client code.
 * Returns cached data if fresh (< 60s old).
 */
export async function getLiveRates(): Promise<OracleRates> {
  // Return cache if still fresh
  if (_cache && Date.now() < _cache.expiresAt) {
    return _cache;
  }

  try {
    const res = await fetch(ORACLE_URL, {
      // Next.js CDN cache as secondary layer (helps on cold starts)
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) throw new Error(`Oracle HTTP ${res.status}`);

    const data: { rates: Record<string, number> } = await res.json();

    const vndPerUsd = data.rates["VND"];
    if (!vndPerUsd || vndPerUsd <= 0) throw new Error("Invalid VND rate from oracle");

    // Convert USD-based oracle rates to VND-based rates
    // VND → X = (USD → X) / (USD → VND)  =  rates[X] / rates[VND]
    const rawRates: Record<CurrencyCode, number> = {
      USD: 1 / vndPerUsd,
      PHP: data.rates["PHP"] / vndPerUsd,
      CNY: data.rates["CNY"] / vndPerUsd,
      RUB: data.rates["RUB"] / vndPerUsd,
      GBP: data.rates["GBP"] / vndPerUsd,
      EUR: data.rates["EUR"] / vndPerUsd,
    };

    // Apply 1% platform spread — receiver gets slightly less than market
    const rates = Object.fromEntries(
      CURRENCY_CODES.map((c) => [c, rawRates[c] * (1 - PLATFORM_SPREAD)])
    ) as Record<CurrencyCode, number>;

    _cache = {
      rates,
      rawRates,
      spread: PLATFORM_SPREAD,
      updatedAt: new Date().toISOString(),
      expiresAt: Date.now() + CACHE_TTL_MS,
      source: "oracle",
    };

    return _cache;
  } catch {
    // Cache fallback too (avoids hammering a failing oracle)
    const fallback = buildFallback();
    _cache = { ...fallback, expiresAt: Date.now() + CACHE_TTL_MS };
    return fallback;
  }
}
