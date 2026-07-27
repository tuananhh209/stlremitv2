import { Networks } from "@stellar/stellar-sdk";

export const STELLAR_WALLET_NETWORK = "PUBLIC" as const;
export const STELLAR_NETWORK_PASSPHRASE = Networks.PUBLIC;
export const STELLAR_RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
  "https://mainnet.sorobanrpc.com";
export const STELLAR_EXPLORER_URL = "https://stellar.expert/explorer/public";
