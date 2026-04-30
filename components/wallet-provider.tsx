"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  requestAccess,
  signTransaction,
  getPublicKey,
} from "@stellar/freighter-api";

export type WalletType = "freighter" | "rabet" | null;
export type UserRole = "sender" | "receiver" | "agent" | null;

export interface BankInfo {
  accountNumber: string;
  bankName: string;
  accountHolder: string;
}

const SESSION_KEY = "stl_session";

interface SessionData {
  address: string;
  walletType: WalletType;
  role: UserRole;
}

function loadSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch { return null; }
}

function saveSession(data: SessionData) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function clearSession() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
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
  // Initialise from localStorage immediately — no flash
  const [address, setAddress] = useState<string | null>(() => loadSession()?.address ?? null);
  const [walletType, setWalletType] = useState<WalletType>(() => loadSession()?.walletType ?? null);
  const [role, setRoleState] = useState<UserRole>(() => loadSession()?.role ?? null);
  const [bankInfo, setBankInfoState] = useState<BankInfo | null>(null);

  // On mount: verify Freighter still has the same account (handles wallet switch)
  useEffect(() => {
    const session = loadSession();
    if (!session || session.walletType !== "freighter") return;

    getPublicKey().then((pk) => {
      if (pk && pk === session.address) {
        // Still same account — keep session
      } else if (pk && pk !== session.address) {
        // Wallet switched — clear session
        clearSession();
        setAddress(null);
        setWalletType(null);
        setRoleState(null);
      }
    }).catch(() => {
      // Extension unavailable — keep session (offline mode)
    });
  }, []);

  // Persist session whenever address/walletType/role changes
  useEffect(() => {
    if (address && walletType) {
      saveSession({ address, walletType, role });
    }
  }, [address, walletType, role]);

  const connect = async (type: WalletType) => {
    try {
      if (type === "freighter") {
        const publicKey = await requestAccess();
        if (publicKey) {
          setAddress(publicKey);
          setWalletType("freighter");
          // role will be set by AppGate — session saved via useEffect
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
    // Clear profile cache
    if (address) {
      try { localStorage.removeItem(`stl_profile_${address}`); } catch { /* ignore */ }
    }
    clearSession();
    setAddress(null);
    setWalletType(null);
    setRoleState(null);
    setBankInfoState(null);
    window.location.href = "/";
  };

  const setRole = (r: UserRole) => {
    setRoleState(r);
    // Immediately persist role to session
    if (address && walletType) {
      saveSession({ address, walletType, role: r });
    }
  };

  const setBankInfo = (info: BankInfo) => setBankInfoState(info);

  const sign = async (xdr: string, network: "PUBLIC" | "TESTNET") => {
    if (walletType === "freighter") {
      const networkPassphrase =
        network === "TESTNET"
          ? "Test SDF Network ; September 2015"
          : "Public Global Stellar Network ; September 2015";
      const signed = await signTransaction(xdr, { network, networkPassphrase });
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
  if (!context) throw new Error("useWallet must be used within a WalletProvider");
  return context;
};
