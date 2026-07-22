import { Networks } from "@stellar/stellar-sdk";

export const STELLAR_WALLET_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toLowerCase() === "mainnet" ? "PUBLIC" : "TESTNET";
export const STELLAR_NETWORK_PASSPHRASE =
  STELLAR_WALLET_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
export const STELLAR_RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
  (STELLAR_WALLET_NETWORK === "PUBLIC" ? "https://mainnet.sorobanrpc.com" : "https://soroban-testnet.stellar.org");
export const STELLAR_EXPLORER_URL = `https://stellar.expert/explorer/${
  STELLAR_WALLET_NETWORK === "PUBLIC" ? "public" : "testnet"
}`;
