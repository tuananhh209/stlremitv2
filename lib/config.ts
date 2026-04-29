// Exchange rates and system configuration
export const EXCHANGE_RATES = {
  VND_TO_USDC: 0.00004, // 1 VND = 0.00004 USDC (25,000 VND = 1 USDC)
  USDC_TO_PHP: 58.0, // 1 USDC = 58 PHP
  TIMEOUT_SECONDS: 300, // 5 minutes
} as const;

export function calculateAmounts(vndAmount: number): {
  usdcEquivalent: number;
  phpPayout: number;
} {
  const usdcEquivalent = vndAmount * EXCHANGE_RATES.VND_TO_USDC;
  const phpPayout = usdcEquivalent * EXCHANGE_RATES.USDC_TO_PHP;
  return { usdcEquivalent, phpPayout };
}
