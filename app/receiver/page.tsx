"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useWallet } from "@/components/wallet-provider";
import { WalletMenu } from "@/components/wallet-menu";
import { useProfile } from "@/lib/hooks/use-profile";
import { BankInfoGuard } from "@/components/bank-info-guard";
import type { RemittanceRecord } from "@/lib/types";
import {
  Clock, CheckCircle2, AlertCircle, ExternalLink,
  Inbox, User, Building2, CreditCard, Settings,
  Save, Loader2,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_agent: { label: "Waiting Agent",  color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
  funded:        { label: "Pending VND",    color: "text-amber-600 bg-amber-50 border-amber-100" },
  processing:    { label: "Processing",     color: "text-blue-600 bg-blue-50 border-blue-100" },
  completed:     { label: "Completed",      color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  expired:       { label: "Expired",        color: "text-gray-500 bg-gray-50 border-gray-100" },
};

const RECEIVER_BANKS = ["BDO", "BPI", "Metrobank", "UnionBank", "PNB", "Landbank", "GCash", "Maya"];

export default function ReceiverDashboard() {
  const { address, bankInfo } = useWallet();
  const { isBankInfoComplete, loading: profileLoading } = useProfile();
  const [activeTab, setActiveTab] = useState<"transfers" | "settings">("transfers");
  const [remittances, setRemittances] = useState<RemittanceRecord[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Settings state
  const [sBankName, setSBankName] = useState("");
  const [sAccountNumber, setSAccountNumber] = useState("");
  const [sAccountHolder, setSAccountHolder] = useState("");
  const [sLoading, setSLoading] = useState(false);
  const [sSaving, setSSaving] = useState(false);
  const [sSaved, setSSaved] = useState(false);
  const [sError, setSError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/remittance");
      if (res.ok) {
        const d = await res.json();
        const all: RemittanceRecord[] = d.remittances ?? [];
        const mine = bankInfo ? all.filter(r => r.receiverAccount === bankInfo.accountNumber) : all;
        setRemittances(mine);
      }
    } catch { /* ignore */ }
  }, [bankInfo]);

  useEffect(() => {
    fetchAll();
    pollingRef.current = setInterval(fetchAll, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchAll]);

  // Load profile when settings tab opens
  useEffect(() => {
    if (activeTab !== "settings" || !address) return;
    setSLoading(true);
    fetch(`/api/profile?wallet=${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setSBankName(data.bankName ?? "");
          setSAccountNumber(data.accountNumber ?? "");
          setSAccountHolder(data.accountHolder ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setSLoading(false));
  }, [activeTab, address]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setSSaving(true);
    setSError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address, role: "receiver",
          bankName: sBankName || null,
          accountNumber: sAccountNumber || null,
          accountHolder: sAccountHolder || null,
        }),
      });
      if (res.ok) { setSSaved(true); setTimeout(() => setSSaved(false), 3000); }
      else { const d = await res.json(); setSError(d.error ?? "Failed to save"); }
    } catch { setSError("Network error"); }
    finally { setSSaving(false); }
  };

  const pending = remittances.filter(r => r.status === "processing");
  const completed = remittances.filter(r => r.status === "completed");
  const totalReceived = completed.reduce((s, r) => s + r.phpPayout, 0);

  return (
    <main className="min-h-screen bg-[#f9f9ff]">
      {/* Header */}
      <header className="h-20 bg-white border-b border-outline/10 px-8 flex items-center justify-between sticky top-0 z-20 premium-shadow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center font-bold text-emerald-700 text-lg">R</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Receiver Dashboard</h1>
            <p className="text-xs text-gray-400 font-mono">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 bg-gray-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab("transfers")}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", activeTab === "transfers" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600")}
            >
              Transfers
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5", activeTab === "settings" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600")}
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
          </div>
          <WalletMenu />
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-8 space-y-8">

        {/* ── TRANSFERS TAB ── */}
        {activeTab === "transfers" && !profileLoading && !isBankInfoComplete("receiver") && (
          <BankInfoGuard role="receiver" onGoToSettings={() => setActiveTab("settings")} />
        )}

        {/* ── TRANSFERS TAB ── */}
        {activeTab === "transfers" && (profileLoading || isBankInfoComplete("receiver")) && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl premium-shadow border border-outline/5">
                <p className="text-sm text-gray-500">Total Received</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{totalReceived.toFixed(2)} <span className="text-lg font-medium text-gray-400">PHP</span></p>
              </div>
              <div className="bg-white p-6 rounded-3xl premium-shadow border border-outline/5">
                <p className="text-sm text-gray-500">Pending Payouts</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{pending.length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl premium-shadow border border-outline/5">
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{completed.length}</p>
              </div>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-3xl premium-shadow border border-outline/5 overflow-hidden">
              <div className="px-8 py-5 border-b border-outline/10 bg-gray-50/50">
                <h2 className="font-bold text-gray-900">Incoming Transfers</h2>
              </div>
              {remittances.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-3 text-gray-300">
                  <Inbox className="w-12 h-12" />
                  <p className="text-sm font-medium text-gray-400">No transfers yet</p>
                  <p className="text-xs text-gray-300">Transfers sent to your account will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-outline/5">
                  {remittances.map(r => {
                    const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.expired;
                    return (
                      <div key={r.txId} className="px-8 py-5 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                            {r.status === "completed" ? <CheckCircle2 className="w-3 h-3" /> : r.status === "expired" ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {cfg.label}
                          </span>
                          <p className="text-xs font-mono text-gray-400">{r.txId.slice(0, 16)}...</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 text-lg">{r.phpPayout.toFixed(2)} PHP</p>
                          <p className="text-xs text-gray-400">from {r.vndAmount.toLocaleString()} VND</p>
                        </div>
                        {r.stellarTxHash && r.status === "completed" && (
                          <a href={`https://stellar.expert/explorer/testnet/tx/${r.stellarTxHash}`} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-300 hover:text-primary transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
              <p className="text-sm text-gray-400 mt-1">Your Philippine payout account for receiving PHP.</p>
            </div>

            {sLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">

                {/* ── Left: Form ── */}
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-10 space-y-8">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Philippine Bank / E-Wallet
                      </label>
                      <select value={sBankName} onChange={e => setSBankName(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-emerald-200 transition-all">
                        <option value="">Select bank...</option>
                        {RECEIVER_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" /> Account Number
                      </label>
                      <input type="text" value={sAccountNumber} onChange={e => setSAccountNumber(e.target.value)} placeholder="09XXXXXXXXX" className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-emerald-200 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Account Holder Name
                      </label>
                      <input type="text" value={sAccountHolder} onChange={e => setSAccountHolder(e.target.value)} placeholder="Full name as on bank account" className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-emerald-200 transition-all" />
                    </div>
                  </div>

                  <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-8 space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Connected Wallet</p>
                    <p className="text-sm font-mono text-gray-700 break-all">{address}</p>
                  </div>

                  {sError && <p className="text-sm text-red-500 font-bold">⚠️ {sError}</p>}

                  <button type="submit" disabled={sSaving} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[24px] font-bold text-sm shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50 transition-all">
                    {sSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> :
                     sSaved  ? <><CheckCircle2 className="w-5 h-5" /> Saved!</> :
                     <><Save className="w-5 h-5" /> Save Settings</>}
                  </button>
                </form>

                {/* ── Right: Live Preview Card ── */}
                <div className="sticky top-24 space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Live Preview</p>
                  <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 overflow-hidden">
                    <div className="bg-emerald-600 px-8 pt-8 pb-6">
                      <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Payout Account</p>
                      <p className="text-2xl font-bold text-white">
                        {sBankName || <span className="text-white/30">Bank name</span>}
                      </p>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                          <CreditCard className="w-3 h-3" /> Account Number
                        </p>
                        <p className={cn("text-2xl font-mono font-bold tracking-wider", sAccountNumber ? "text-gray-900" : "text-gray-200")}>
                          {sAccountNumber || "0000 0000 000"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                          <User className="w-3 h-3" /> Account Holder
                        </p>
                        <p className={cn("text-lg font-bold", sAccountHolder ? "text-gray-900" : "text-gray-200")}>
                          {sAccountHolder || "Full name"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
