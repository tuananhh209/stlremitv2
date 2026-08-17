// Exchange rates and system configuration

export type CurrencyCode = "PHP" | "USD" | "CNY" | "RUB" | "GBP" | "EUR";

export interface CurrencyInfo {
  flag: string;
  code: CurrencyCode;
  name: string;
  country: string;
  accountLabel: string;
  placeholder: string;
  namePlaceholder: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  PHP: { flag: "🇵🇭", code: "PHP", name: "Philippine Peso", country: "Philippines",    accountLabel: "GCash / Account No.",     placeholder: "09XXXXXXXXX",                        namePlaceholder: "Juan Dela Cruz"   },
  USD: { flag: "🇺🇸", code: "USD", name: "US Dollar",       country: "United States",  accountLabel: "Bank Account / ACH No.",  placeholder: "1234567890",                         namePlaceholder: "John Smith"        },
  CNY: { flag: "🇨🇳", code: "CNY", name: "Chinese Yuan",    country: "China",           accountLabel: "Alipay / UnionPay No.",   placeholder: "1234 5678 9012 3456",                namePlaceholder: "Li Wei"            },
  RUB: { flag: "🇷🇺", code: "RUB", name: "Russian Ruble",   country: "Russia",          accountLabel: "Bank Account No.",        placeholder: "40817810099910004312",               namePlaceholder: "Иван Иванов"       },
  GBP: { flag: "🇬🇧", code: "GBP", name: "British Pound",   country: "United Kingdom",  accountLabel: "Sort Code / Account No.", placeholder: "12-34-56 / 87654321",               namePlaceholder: "James Smith"       },
  EUR: { flag: "🇫🇷", code: "EUR", name: "Euro",             country: "France",          accountLabel: "IBAN",                    placeholder: "FR76 3000 6000 0112 3456 7890 189", namePlaceholder: "Jean Dupont"       },
};

/** Hardcoded fallback rates — used only when oracle is unavailable */
export const EXCHANGE_RATES = {
  VND_TO_USDC: 0.00004, // 1 VND = 0.00004 USD (25,000 VND = 1 USD)
  USDC_TO_PHP: 58.0,    // Philippines
  USDC_TO_USD: 1.0,     // United States
  USDC_TO_CNY: 7.25,    // China
  USDC_TO_RUB: 92.0,    // Russia
  USDC_TO_GBP: 0.79,    // United Kingdom
  USDC_TO_EUR: 0.92,    // France / Eurozone
  TIMEOUT_SECONDS: 300, // 5 minutes
} as const;

export const PLATFORM_SPREAD = 0.01; // 1% platform fee

const FALLBACK_PAYOUT_RATES: Record<CurrencyCode, number> = {
  PHP: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_PHP,
  USD: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_USD,
  CNY: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_CNY,
  RUB: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_RUB,
  GBP: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_GBP,
  EUR: EXCHANGE_RATES.VND_TO_USDC * EXCHANGE_RATES.USDC_TO_EUR,
};

export class InvalidAmountError extends Error {
  constructor(message = "Amount must be a positive number") {
    super(message);
    this.name = "InvalidAmountError";
  }
}

/** A rate is only usable when it is a finite positive number. */
function usableRate(rate: number | undefined): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}

/**
 * Calculate USDC collateral and destination payout for a VND amount.
 *
 * @param vndAmount  - Amount in VND the sender will pay
 * @param currency   - Destination currency code
 * @param oracleRates - Live VND-based rates WITH spread (from /api/rates).
 *                      Falls back to hardcoded rates + spread when a rate is
 *                      missing or unusable, so a bad oracle payload can never
 *                      turn into a NaN payout.
 */
export function calculateAmounts(
  vndAmount: number,
  currency: CurrencyCode = "PHP",
  oracleRates?: Partial<Record<CurrencyCode, number>>
): { usdcEquivalent: number; phpPayout: number } {
  if (!Number.isFinite(vndAmount) || vndAmount <= 0) {
    throw new InvalidAmountError();
  }

  // USD rate determines USDC collateral (1 USDC ≈ 1 USD)
  const vndToUsd = usableRate(oracleRates?.USD)
    ? oracleRates.USD
    : EXCHANGE_RATES.VND_TO_USDC;

  // Payout rate: oracle already includes spread; fallback applies it manually
  const payoutRate = usableRate(oracleRates?.[currency])
    ? oracleRates[currency]!
    : FALLBACK_PAYOUT_RATES[currency] * (1 - PLATFORM_SPREAD);

  return {
    usdcEquivalent: vndAmount * vndToUsd,
    phpPayout: vndAmount * payoutRate,
  };
}
