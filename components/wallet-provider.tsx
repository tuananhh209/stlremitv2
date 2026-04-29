"use client";

import React, { createContext, useContext, useState } from "react";
import {
  isConnected as isFreighterConnected,
  getPublicKey,
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
        const connected = await isFreighterConnected();
        if (connected) {
          const publicKey = await getPublicKey();
          setAddress(publicKey);
          setWalletType("freighter");
        } else {
          alert(
            "Freighter wallet not found. Please install the Freighter extension."
          );
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
    } catch (error) {
      console.error("Wallet connection error:", error);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setWalletType(null);
    setRoleState(null);
    setBankInfoState(null);
  };

  const setRole = (r: UserRole) => setRoleState(r);
  const setBankInfo = (info: BankInfo) => setBankInfoState(info);

  const sign = async (xdr: string, network: "PUBLIC" | "TESTNET") => {
    if (walletType === "freighter") {
      return await signTransaction(xdr, { network });
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
