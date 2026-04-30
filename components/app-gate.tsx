"use client";

import React, { useState, useEffect } from "react";
import { useWallet, type UserRole } from "./wallet-provider";
import { ConnectWallet } from "./connect-wallet";
import {
  Globe2,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  LogOut,
} from "lucide-react";

// ── Step 1: Connect Wallet ────────────────────────────────────────────────────
function ConnectStep() {
  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center relative overflow-hidden p-6">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />

      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold tracking-wider uppercase">
            <Globe2 className="w-3 h-3" />
            Stellar Remittance
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 leading-[1.1]">
            Global money <br />
            <span className="text-primary">transfer</span> simplified.
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Send money across borders instantly using the Stellar blockchain.
            Secure, transparent, and escrow-powered.
          </p>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-gray-900 text-sm">Instant</h3>
              <p className="text-xs text-gray-500">Settled on Stellar</p>
            </div>
            <div className="space-y-2">
              <ShieldCheck className="w-5 h-5 text-secondary" />
              <h3 className="font-semibold text-gray-900 text-sm">Secure</h3>
              <p className="text-xs text-gray-500">Soroban Escrow</p>
            </div>
            <div className="space-y-2">
              <Globe2 className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">Global</h3>
              <p className="text-xs text-gray-500">VND → PHP</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl premium-shadow space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Connect Wallet</h2>
            <p className="text-sm text-gray-500 mt-1">Connect your Stellar wallet to get started.</p>
          </div>
          <ConnectWallet />
          <p className="text-center text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em]">
            Powered by Soroban · Stellar Testnet
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Select Role ───────────────────────────────────────────────────────
function RoleStep({ onSelect }: { onSelect: (role: UserRole) => void }) {
  const { address, disconnect } = useWallet();

  const roles = [
    {
      id: "sender" as UserRole,
      title: "Sender",
      desc: "Send VND from Vietnam to Philippines",
      color: "hover:border-primary/50 hover:bg-primary/5",
      badge: "bg-primary/10 text-primary",
    },
    {
      id: "receiver" as UserRole,
      title: "Receiver",
      desc: "Receive PHP payout in Philippines",
      color: "hover:border-emerald-300 hover:bg-emerald-50",
      badge: "bg-emerald-100 text-emerald-700",
    },
    {
      id: "agent" as UserRole,
      title: "Agent",
      desc: "Manage remittances and liquidity pool",
      color: "hover:border-indigo-300 hover:bg-indigo-50",
      badge: "bg-indigo-100 text-indigo-700",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Globe2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Select Your Role</h1>
          <p className="text-gray-500 text-sm">Choose how you want to use STL Remit</p>
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-outline/10 premium-shadow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Connected</p>
              <p className="text-sm font-mono text-gray-900">{address?.slice(0, 6)}...{address?.slice(-6)}</p>
            </div>
          </div>
          <button
            onClick={disconnect}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect
          </button>
        </div>

        <div className="space-y-3">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`w-full flex items-center gap-4 p-5 bg-white border border-outline/10 rounded-2xl transition-all premium-shadow group ${r.color}`}
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900">{r.title}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${r.badge}`}>
                    {r.id}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{r.desc}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── App Gate ──────────────────────────────────────────────────────────────────
export function AppGate({ children }: { children: React.ReactNode }) {
  const { isConnected, role, setRole } = useWallet();
  const [step, setStep] = useState<"connect" | "role" | "app">("connect");

  useEffect(() => {
    if (!isConnected) { setStep("connect"); return; }
    if (role) { setStep("app"); return; }
    setStep("role");
  }, [isConnected, role]);

  if (step === "connect" || !isConnected) return <ConnectStep />;

  if (step === "role") {
    return (
      <RoleStep
        onSelect={(r) => {
          setRole(r);
          // step updates via useEffect
        }}
      />
    );
  }

  return <>{children}</>;
}
