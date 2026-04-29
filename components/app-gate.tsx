"use client";

import React, { useState } from "react";
import { useWallet, type UserRole, type BankInfo } from "./wallet-provider";
import { ConnectWallet } from "./connect-wallet";
import {
  Globe2,
  ShieldCheck,
  Zap,
  ArrowRight,
  User,
  Building2,
  CreditCard,
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
        {/* Left */}
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

        {/* Right */}
        <div className="glass-card p-8 rounded-3xl premium-shadow space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Connect Wallet</h2>
            <p className="text-sm text-gray-500 mt-1">
              Connect your Stellar wallet to get started.
            </p>
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
      icon: "💸",
      title: "Sender",
      desc: "Send VND from Vietnam to Philippines",
      color: "hover:border-primary/50 hover:bg-primary/5",
      badge: "bg-primary/10 text-primary",
    },
    {
      id: "receiver" as UserRole,
      icon: "📥",
      title: "Receiver",
      desc: "Receive PHP payout in Philippines",
      color: "hover:border-emerald-300 hover:bg-emerald-50",
      badge: "bg-emerald-100 text-emerald-700",
    },
    {
      id: "agent" as UserRole,
      icon: "🏦",
      title: "Agent",
      desc: "Manage remittances and liquidity pool",
      color: "hover:border-indigo-300 hover:bg-indigo-50",
      badge: "bg-indigo-100 text-indigo-700",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Globe2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Select Your Role</h1>
          <p className="text-gray-500 text-sm">
            Choose how you want to use STL Remit
          </p>
        </div>

        {/* Wallet info */}
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-outline/10 premium-shadow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Connected</p>
              <p className="text-sm font-mono text-gray-900">
                {address?.slice(0, 6)}...{address?.slice(-6)}
              </p>
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

        {/* Role cards */}
        <div className="space-y-3">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`w-full flex items-center gap-4 p-5 bg-white border border-outline/10 rounded-2xl transition-all premium-shadow group ${r.color}`}
            >
              <div className="text-3xl">{r.icon}</div>
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

// ── Step 3: Bank Info (Sender & Receiver only) ────────────────────────────────

function BankInfoStep({
  role,
  onComplete,
}: {
  role: UserRole;
  onComplete: (info: BankInfo) => void;
}) {
  const { disconnect } = useWallet();
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  const isSender = role === "sender";

  const banks = isSender
    ? ["Vietcombank", "Techcombank", "BIDV", "VPBank", "MB Bank", "ACB", "Sacombank", "TPBank"]
    : ["BDO", "BPI", "Metrobank", "UnionBank", "PNB", "Landbank", "GCash", "Maya"];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountNumber.trim() || !bankName.trim() || !accountHolder.trim()) return;
    onComplete({ accountNumber: accountNumber.trim(), bankName: bankName.trim(), accountHolder: accountHolder.trim() });
  }

  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="text-4xl">{isSender ? "💸" : "📥"}</div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isSender ? "Your Bank Account" : "Your Payout Account"}
          </h1>
          <p className="text-gray-500 text-sm">
            {isSender
              ? "Enter your Vietnamese bank account for VND transfers"
              : "Enter your Philippine account for PHP payouts"}
          </p>
        </div>

        <div className="bg-white rounded-3xl premium-shadow border border-outline/5 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Bank Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {isSender ? "Vietnamese Bank" : "Philippine Bank / E-Wallet"}
              </label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="">Select bank...</option>
                {banks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Account Number */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Account Number
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={isSender ? "0123456789" : "09XXXXXXXXX"}
                required
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Account Holder */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Account Holder Name
              </label>
              <input
                type="text"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Full name as on bank account"
                required
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={!accountNumber || !bankName || !accountHolder}
              className="w-full btn-primary h-14 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <button
          onClick={disconnect}
          className="w-full text-sm text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          Disconnect & Start Over
        </button>
      </div>
    </div>
  );
}

// ── App Gate ──────────────────────────────────────────────────────────────────

export function AppGate({ children }: { children: React.ReactNode }) {
  const { isConnected, role, bankInfo, setRole, setBankInfo } = useWallet();
  const [pendingRole, setPendingRole] = useState<UserRole>(null);

  // Step 1: Not connected → show connect screen
  if (!isConnected) {
    return <ConnectStep />;
  }

  // Step 2: Connected but no role → show role selection
  if (!role) {
    return (
      <RoleStep
        onSelect={(r) => {
          if (r === "agent") {
            setRole(r); // Agent skips bank info
          } else {
            setPendingRole(r); // Sender/Receiver need bank info
          }
        }}
      />
    );
  }

  // Step 3: Sender/Receiver without bank info → show bank info form
  if ((role === "sender" || role === "receiver") && !bankInfo) {
    return (
      <BankInfoStep
        role={pendingRole ?? role}
        onComplete={(info) => {
          setBankInfo(info);
          if (pendingRole) setRole(pendingRole);
        }}
      />
    );
  }

  // All steps complete → render app
  return <>{children}</>;
}
