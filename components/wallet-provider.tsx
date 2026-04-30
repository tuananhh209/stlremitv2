"use client";

import React, { createContext, useContext, useState } from "react";
import {
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

export type WalletType = "freighter" | "rabet" | null;
export type UserRole = "sender" | "receiver" | "agent" | null;

export interface BankInfo {
  accountNumber: string;
  bankName: string;
  accountHolder: string;
}

interface WalletContextType {
  address: string | null;
  walletType: WalletType;
  isConnected: boolean;
  role: UserRole;
  bankInfo: BankInfo | null;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
  setRole: (role: UserRole) => void;
  setBankInfo: (info: BankInfo) => void;
  sign: (xdr: string, network: "PUBLIC" | "TESTNET") => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [role, setRoleState] = useState<UserRole>(null);
  const [bankInfo, setBankInfoState] = useState<BankInfo | null>(null);

  const connect = async (type: WalletType) => {
    try {
      if (type === "freighter") {
        // requestAccess() triggers the Freighter popup asking for permission
        // Returns publicKey directly, throws if user rejects or extension not found
        const publicKey = await requestAccess();
        if (publicKey) {
          setAddress(publicKey);
          setWalletType("freighter");
        }
      } else if (type === "rabet") {
        if (typeof window !== "undefined" && (window as any).rabet) {
          const result = await (window as any).rabet.connect();
          setAddress(result.publicKey);
          setWalletType("rabet");
        } else {
          alert("Rabet wallet not found. Please install the Rabet extension.");
        }
      }
    } catch (error: any) {
      // Freighter throws a string error when extension not installed or user rejects
      const msg = typeof error === "string" ? error : error?.message ?? "";
      if (msg.toLowerCase().includes("not installed") || msg.toLowerCase().includes("not found")) {
        alert("Freighter extension not found. Please install it from https://freighter.app");
      } else if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied")) {
        // User rejected — silently ignore
      } else {
        console.error("Wallet connection error:", error);
      }
    }
  };

  const disconnect = () => {
    // Clear profile cache for current address before resetting state
    if (address && typeof window !== "undefined") {
      try { localStorage.removeItem(`stl_profile_${address}`); } catch { /* ignore */ }
    }
    setAddress(null);
    setWalletType(null);
    setRoleState(null);
    setBankInfoState(null);
    // Force redirect to root so AppGate can re-run role selection
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const setRole = (r: UserRole) => setRoleState(r);
  const setBankInfo = (info: BankInfo) => setBankInfoState(info);

  const sign = async (xdr: string, network: "PUBLIC" | "TESTNET") => {
    if (walletType === "freighter") {
      // freighter-api v2: signTransaction returns signed XDR string directly
      const networkPassphrase =
        network === "TESTNET"
          ? "Test SDF Network ; September 2015"
          : "Public Global Stellar Network ; September 2015";
      const signed = await signTransaction(xdr, {
        network,
        networkPassphrase,
      });
      // v2 returns string directly
      return typeof signed === "string" ? signed : (signed as any).signedTransaction;
    } else if (walletType === "rabet") {
      const result = await (window as any).rabet.sign(xdr, network);
      return result.xdr;
    }
    throw new Error("No wallet connected");
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        walletType,
        isConnected: !!address,
        role,
        bankInfo,
        connect,
        disconnect,
        setRole,
        setBankInfo,
        sign,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context)
    throw new Error("useWallet must be used within a WalletProvider");
  return context;
};
