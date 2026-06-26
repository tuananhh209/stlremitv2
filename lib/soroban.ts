import { Contract, Address, rpc as StellarRpc, nativeToScVal } from "@stellar/stellar-sdk";
import { STELLAR_CONFIG } from "./stellar-config";
import { stellarService } from "./stellar";

// Frontend integration compatibility for Soroban contract functions.
// Matches the deployed contract functions with the frontend logic.

export const ESCROW_CONTRACT_ID = STELLAR_CONFIG.ESCROW_CONTRACT_ID;
export const USDC_TOKEN_ID = STELLAR_CONFIG.USDC_TOKEN_ID;

export const getContractBalance = () => stellarService.getContractBalance();
export const fundContract = (amount: number) => stellarService.fundContract(amount);
export const reserveCollateral = (txId: string, amount: number) => stellarService.reserveCollateral(txId, amount);
export const confirmPayout = (txId: string) => stellarService.confirmPayout(txId);
export const refundCollateral = (txId: string) => stellarService.refundCollateral(txId);

// Helper for frontend wallet connection references
export function checkWalletConnection(address: string | null) {
  if (!address) {
    throw new Error("Connect Wallet Feature Check: Wallet is not connected.");
  }
  return true;
}
