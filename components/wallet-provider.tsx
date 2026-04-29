"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { isConnected as isFreighterConnected, getPublicKey, signTransaction } from "@stellar/freighter-api";

type WalletType = "freighter" | "rabet" | null;

interface WalletContextType {
  address: string | null;
  walletType: WalletType;
  isConnected: boolean;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
  sign: (xdr: string, network: "PUBLIC" | "TESTNET") => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType>(null);

  const connect = async (type: WalletType) => {
    try {
      if (type === "freighter") {
        const connected = await isFreighterConnected();
        if (connected) {
          const publicKey = await getPublicKey();
          setAddress(publicKey);
          setWalletType("freighter");
        } else {
          alert("Freighter not found or not connected");
        }
      } else if (type === "rabet") {
        if (typeof window !== "undefined" && (window as any).rabet) {
          const result = await (window as any).rabet.connect();
          setAddress(result.publicKey);
          setWalletType("rabet");
        } else {
          alert("Rabet not found");
        }
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setWalletType(null);
  };

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
    <WalletContext.Provider value={{ address, walletType, isConnected: !!address, connect, disconnect, sign }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within a WalletProvider");
  return context;
}
