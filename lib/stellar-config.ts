import { env } from "./env";

// Stellar testnet configuration
export const STELLAR_CONFIG = {
  RPC_URL: "https://soroban-testnet.stellar.org",
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  HORIZON_URL: "https://horizon-testnet.stellar.org",
  ESCROW_CONTRACT_ID: env.ESCROW_CONTRACT_ID,
  AGENT_SECRET_KEY: env.AGENT_SECRET_KEY,
  AGENT_PUBLIC_KEY: env.AGENT_PUBLIC_KEY,
  // Fake USDC token on Stellar testnet
  USDC_TOKEN_ID: env.USDC_TOKEN_ID ?? "CDVSELRDNGPJNFGACTCH34TPIOBAQLGUKDALQE7P367AUCMYREBHJOA7",
  TIMEOUT_SECONDS: 300,
} as const;
