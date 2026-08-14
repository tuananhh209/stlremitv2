const FIELDS = [
  "walletAddress", "role", "bankName", "accountNumber", "accountHolder", "qrImageUrl",
  "agentBankName", "agentAccountNumber", "agentAccountHolder", "agentQrImageUrl",
] as const;

export function profileAuthMessage(profile: Record<string, unknown>, timestamp: string): string {
  return ["STLRemit Profile Update", timestamp, ...FIELDS.map((key) => `${key}:${profile[key] ?? ""}`)].join("\n");
}
