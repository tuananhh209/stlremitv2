"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet-provider";
import { WalletMenu } from "@/components/wallet-menu";
import { useProfile } from "@/lib/hooks/use-profile";
import { BankInfoGuard } from "@/components/bank-info-guard";
import type { RemittanceRecord } from "@/lib/types";
import {
  Clock, CheckCircle2, AlertCircle, ExternalLink,
  Inbox, User, Building2, CreditCard, Settings,
  Save, Loader2, ShieldCheck, Activity, Search,
  ArrowRight, Globe2, X, Info, TrendingUp, History
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_agent: { label: "Waiting Agent",  color: "text-indigo-600 bg-indigo-50 border-indigo-100", icon: Activity },
  funded:           { label: "Pending VND",    color: "text-amber-600 bg-amber-50 border-amber-100",   icon: Clock },
  processing:       { label: "Agent Paying",   color: "text-blue-600 bg-blue-50 border-blue-100",      icon: TrendingUp },
  payout_submitted: { label: "Confirm Now",    color: "text-indigo-600 bg-indigo-50 border-indigo-100", icon: Activity },
  completed:        { label: "Completed",      color: "text-emerald-600 bg-emerald-50 border-emerald-100", icon: CheckCircle2 },
  expired:       { label: "Expired",        color: "text-gray-500 bg-gray-50 border-gray-100",      icon: AlertCircle },
  cancelled:     { label: "Cancelled",      color: "text-red-500 bg-red-50 border-red-100",        icon: X },
};

const RECEIVER_BANKS = ["BDO", "BPI", "Metrobank", "UnionBank", "PNB", "Landbank", "GCash", "Maya"];

export default function ReceiverDashboard() {
  const router = useRouter();
  const { address, bankInfo, role, sign } = useWallet();
  const { isBankInfoComplete, loading: profileLoading, refetch: refetchProfile } = useProfile();
  
  const [activeTab, setActiveTab] = useState<"transfers" | "history" | "settings">("transfers");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Data State
  const [recentRemittances, setRecentRemittances] = useState<RemittanceRecord[]>([]);
  const [allRemittances, setAllRemittances] = useState<RemittanceRecord[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  
  // Detail Modal State
  const [selectedTx, setSelectedTx] = useState<RemittanceRecord | null>(null);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [senderProfile, setSenderProfile] = useState<any>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [loadingSender, setLoadingSender] = useState(false);

  // Settings state
  const [sBankName, setSBankName] = useState("");
  const [sAccountNumber, setSAccountNumber] = useState("");
  const [sAccountHolder, setSAccountHolder] = useState("");
  const [sLoading, setSLoading] = useState(false);
  const [sSaving, setSSaving] = useState(false);
  const [sSaved, setSSaved] = useState(false);
  const [sError, setSError] = useState<string | null>(null);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Role guard
  useEffect(() => {
    if (role && role !== "receiver") {
      router.replace("/");
    }
  }, [role, router]);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch(`/api/remittance?limit=10&receiver=${address || ""}`);
      if (res.ok) {
        const d = await res.json();
        const all: RemittanceRecord[] = d.remittances ?? [];
        setRecentRemittances(all);
      }
    } catch { /* ignore */ }
    finally { setActivityLoading(false); }
  }, [address]);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`/api/remittance?receiver=${address || ""}`);
      if (res.ok) {
        const d = await res.json();
        const all: RemittanceRecord[] = d.remittances ?? [];
        setAllRemittances(all);
      }
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, [address]);

  useEffect(() => {
    fetchRecent();
    const id = setInterval(fetchRecent, 5000);
    return () => clearInterval(id);
  }, [fetchRecent]);

  useEffect(() => {
    if (activeTab === "transfers" || activeTab === "history") {
      fetchAll();
    }
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, [fetchAll, activeTab]);

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

  // Load profiles when modal opens
  useEffect(() => {
    if (selectedTx) {
      if (selectedTx.agentWallet) {
        setLoadingAgent(true);
        fetch(`/api/profile?wallet=${selectedTx.agentWallet}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => setAgentProfile(data))
          .catch(() => {})
          .finally(() => setLoadingAgent(false));
      } else {
        setAgentProfile(null);
      }

      if (selectedTx.senderWallet) {
        setLoadingSender(true);
        fetch(`/api/profile?wallet=${selectedTx.senderWallet}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => setSenderProfile(data))
          .catch(() => {})
          .finally(() => setLoadingSender(false));
      } else {
        setSenderProfile(null);
      }
    } else {
      setAgentProfile(null);
      setSenderProfile(null);
    }
  }, [selectedTx]);

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
      if (res.ok) { setSSaved(true); setTimeout(() => setSSaved(false), 3000); refetchProfile(); }
      else { const d = await res.json(); setSError(d.error ?? "Failed to save"); }
    } catch { setSError("Network error"); }
    finally { setSSaving(false); }
  };

  async function handleReceiverConfirm(txId: string) {
    if (!address) return;
    setConfirmingId(txId);
    try {
      const buildRes = await fetch(`/api/remittance/${txId}/build-receiver-confirm-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverPublicKey: address }),
      });
      if (!buildRes.ok) {
        const d = await buildRes.json();
        alert(`Failed to build transaction: ${d.error}`);
        return;
      }
      const { xdr } = await buildRes.json();

      let signedXdr: string;
      try {
        signedXdr = await sign(xdr, "TESTNET");
      } catch (err: any) {
        alert(`Signing cancelled: ${err?.message ?? err}`);
        return;
      }

      const submitRes = await fetch("/api/stellar/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr }),
      });
      if (!submitRes.ok) {
        const d = await submitRes.json();
        alert(`Transaction failed: ${d.error}`);
        return;
      }
      const { txHash } = await submitRes.json();

      await fetch(`/api/remittance/${txId}/receiver-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stellarTxHash: txHash }),
      });
      fetchAll();
      setSelectedTx(null);
    } catch (err: any) {
      alert(`Error: ${err?.message ?? "Unknown error"}`);
    } finally {
      setConfirmingId(null);
    }
  }

  const pendingCount = allRemittances.filter(r => r.status === "processing").length;
  const completed = allRemittances.filter(r => r.status === "completed");
  const totalReceived = completed.reduce((s, r) => s + r.phpPayout, 0);

  const filteredRecent = recentRemittances.filter(r => 
    r.txId.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.senderName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = allRemittances.filter(r => 
    r.txId.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.senderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.receiverName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#f9f9ff] flex">
      {/* ── Sidebar ── */}
      <aside className="w-72 bg-white border-r border-outline/5 p-8 flex-col gap-10 hidden xl:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
            <Globe2 className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900 tracking-tight">STL Remit</span>
        </div>

        <nav className="flex flex-col gap-2">
          <button
            onClick={() => setActiveTab("transfers")}
            className={cn(
              "flex items-center gap-4 px-4 py-3 rounded-2xl font-bold text-sm transition-all",
              activeTab === "transfers" ? "bg-emerald-50 text-emerald-600" : "text-gray-400 hover:bg-gray-50"
            )}
          >
            <Inbox className="w-5 h-5" /> Transfers
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-4 px-4 py-3 rounded-2xl font-bold text-sm transition-all",
              activeTab === "history" ? "bg-emerald-50 text-emerald-600" : "text-gray-400 hover:bg-gray-50"
            )}
          >
            <History className="w-5 h-5" /> History
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "flex items-center gap-4 px-4 py-3 rounded-2xl font-bold text-sm transition-all",
              activeTab === "settings" ? "bg-emerald-50 text-emerald-600" : "text-gray-400 hover:bg-gray-50"
            )}
          >
            <Settings className="w-5 h-5" /> Settings
          </button>
        </nav>

        <div className="mt-auto bg-gray-900 rounded-[32px] p-6 text-white space-y-4 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Receiver App</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Confirm payouts here to release agent's USDC collateral.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-outline/5 px-8 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeTab}</h1>
            <p className="text-xs text-gray-400 font-medium mt-1">Stellar Blockchain · Receiver Mode</p>
          </div>
          <WalletMenu />
        </header>

        <div className="p-8 lg:p-12 space-y-10 overflow-y-auto max-w-5xl mx-auto w-full">

          {/* ── BANK INFO GUARD ── */}
          {!isBankInfoComplete("receiver") && activeTab !== "settings" && (
            <BankInfoGuard role="receiver" onGoToSettings={() => setActiveTab("settings")} />
          )}

          {/* ── TRANSFERS TAB ── */}
          {activeTab === "transfers" && isBankInfoComplete("receiver") && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[32px] premium-shadow border border-outline/5 space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600"><TrendingUp className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Received</p>
                    <p className="text-3xl font-bold text-gray-900">{totalReceived.toFixed(2)} <span className="text-sm font-medium text-gray-300">PHP</span></p>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[32px] premium-shadow border border-outline/5 space-y-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600"><Clock className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending Payouts</p>
                    <p className="text-3xl font-bold text-gray-900">{pendingCount}</p>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[32px] premium-shadow border border-outline/5 space-y-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><CheckCircle2 className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Successful</p>
                    <p className="text-3xl font-bold text-gray-900">{completed.length}</p>
                  </div>
                </div>
              </div>

              {/* Incoming Transfers List (Short list) */}
              <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 overflow-hidden">
                <div className="p-10 border-b border-outline/5 flex items-center justify-between bg-gray-50/30">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Recent Transfers</h2>
                    <p className="text-sm text-gray-400 mt-1">Real-time status of funds sent to you.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab("history")}
                    className="text-xs font-bold text-emerald-600 uppercase tracking-widest hover:underline"
                  >
                    View All
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/50">
                      <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                        <th className="px-10 py-6">Status / Time</th>
                        <th className="px-10 py-6">Amount (PHP)</th>
                        <th className="px-10 py-6">From (VND)</th>
                        <th className="px-10 py-6 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline/5">
                      {filteredRecent.length === 0 && !activityLoading ? (
                        <tr>
                          <td colSpan={4} className="px-10 py-32 text-center">
                            <div className="flex flex-col items-center gap-4 text-gray-300">
                              <Inbox className="w-12 h-12" />
                              <p className="font-bold">No transfers found</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredRecent.map((r) => {
                          const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.expired;
                          const Icon = cfg.icon;
                          return (
                            <tr key={r.txId} className="hover:bg-gray-50/30 transition-colors group">
                              <td className="px-10 py-7">
                                <div className="space-y-2">
                                  <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border", cfg.color)}>
                                    <Icon className="w-3 h-3" />{cfg.label}
                                  </span>
                                  <p className="text-[10px] text-gray-300 font-mono mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                                </div>
                              </td>
                              <td className="px-10 py-7">
                                <p className="text-lg font-bold text-emerald-600">{r.phpPayout.toFixed(2)} PHP</p>
                              </td>
                              <td className="px-10 py-7">
                                <p className="text-sm font-bold text-gray-400">{r.vndAmount.toLocaleString()} VND</p>
                              </td>
                              <td className="px-10 py-7 text-right">
                                <button 
                                  onClick={() => setSelectedTx(r)}
                                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border border-outline/5 hover:border-emerald-500 font-bold text-xs shadow-sm"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                  <span>Details</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {activityLoading && filteredRecent.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-10 py-32 text-center">
                            <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto" />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === "history" && isBankInfoComplete("receiver") && (
            <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 overflow-hidden">
              <div className="p-10 border-b border-outline/5 flex items-center justify-between bg-gray-50/30">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
                  <p className="text-sm text-gray-400 mt-1">Full history of all incoming remittances.</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-outline/5 shadow-sm min-w-[280px]">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search ID or Status..." 
                    className="bg-transparent border-none text-sm font-medium focus:ring-0 w-full" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                      <th className="px-10 py-6">Date / ID</th>
                      <th className="px-10 py-6">Sender Info</th>
                      <th className="px-10 py-6">Amount (PHP)</th>
                      <th className="px-10 py-6">Status</th>
                      <th className="px-10 py-6 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/5">
                    {filteredHistory.length === 0 && !historyLoading ? (
                      <tr>
                        <td colSpan={5} className="px-10 py-32 text-center">
                          <div className="flex flex-col items-center gap-4 text-gray-300">
                            <History className="w-12 h-12" />
                            <p className="font-bold">No history found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((r) => {
                        const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.expired;
                        const Icon = cfg.icon;
                        return (
                          <tr key={r.txId} className="hover:bg-gray-50/30 transition-colors group">
                            <td className="px-10 py-7">
                              <p className="text-sm font-bold text-gray-900">{new Date(r.createdAt).toLocaleDateString()}</p>
                              <p className="text-[10px] text-gray-300 font-mono mt-1">{r.txId.slice(0, 12)}...</p>
                            </td>
                            <td className="px-10 py-7">
                              <p className="text-sm font-bold text-gray-900">{r.senderName || "Vietnamese Sender"}</p>
                              <p className="text-[10px] text-gray-400 font-mono mt-1">{r.senderWallet ? `${r.senderWallet.slice(0, 6)}...${r.senderWallet.slice(-4)}` : "No Wallet"}</p>
                            </td>
                            <td className="px-10 py-7">
                              <p className="text-lg font-bold text-emerald-600">{r.phpPayout.toFixed(2)} PHP</p>
                            </td>
                            <td className="px-10 py-7">
                              <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border", cfg.color)}>
                                <Icon className="w-3 h-3" />{cfg.label}
                              </span>
                            </td>
                            <td className="px-10 py-7 text-right">
                              <button 
                                onClick={() => setSelectedTx(r)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border border-outline/5 hover:border-emerald-500 font-bold text-xs shadow-sm"
                              >
                                <Info className="w-3.5 h-3.5" />
                                <span>Details</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {historyLoading && filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-10 py-32 text-center">
                          <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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

                    <button type="submit" disabled={sSaving} className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[24px] font-bold text-sm shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50 transition-all">
                      {sSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> :
                       sSaved  ? <><CheckCircle2 className="w-5 h-5" /> Saved!</> :
                       <><Save className="w-5 h-5" /> Save Settings</>}
                    </button>
                  </form>

                  <div className="sticky top-32 space-y-4">
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
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            {/* Modal Header */}
            <div className="p-8 border-b border-outline/5 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-outline/5">
                  <Info className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Transfer Details</h3>
                  <p className="text-[10px] text-gray-400 font-mono tracking-wider">{selectedTx.txId}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTx(null)}
                className="p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-10 space-y-10 overflow-y-auto max-h-[70vh]">
              
              {/* Summary Bar */}
              <div className="grid grid-cols-2 gap-6 bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100/30">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">You Receive</p>
                  <p className="text-3xl font-bold text-emerald-700">{selectedTx.phpPayout.toFixed(2)} PHP</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Sent Amount</p>
                  <p className="text-2xl font-bold text-emerald-700/60">{selectedTx.vndAmount.toLocaleString()} VND</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Sender Info */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Sender Information
                  </h4>
                  <div className="space-y-4 bg-gray-50 p-6 rounded-3xl border border-outline/5">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name / Role</p>
                      <p className="text-sm font-bold text-gray-900">{selectedTx.senderName || "Vietnamese Sender"}</p>
                    </div>
                    {loadingSender ? (
                      <div className="py-2"><Loader2 className="w-4 h-4 animate-spin text-gray-200" /></div>
                    ) : senderProfile && (
                      <>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sender Bank</p>
                          <p className="text-xs font-bold text-gray-700">{senderProfile.bankName}</p>
                          <p className="text-xs text-gray-400">{senderProfile.accountNumber}</p>
                        </div>
                      </>
                    )}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stellar Wallet</p>
                      <p className="text-[11px] font-mono text-gray-500 break-all">{selectedTx.senderWallet || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Agent Info */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Agent Information
                  </h4>
                  <div className="space-y-4 bg-gray-50 p-6 rounded-3xl border border-outline/5">
                    {loadingAgent ? (
                      <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                    ) : agentProfile ? (
                      <>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent Bank</p>
                          <p className="text-sm font-bold text-gray-900">{agentProfile.agentBankName || "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account Details</p>
                          <p className="text-xs font-medium text-gray-700">{agentProfile.agentAccountNumber}</p>
                          <p className="text-xs text-gray-400 uppercase tracking-tighter">{agentProfile.agentAccountHolder}</p>
                        </div>
                        <div className="space-y-1 pt-2 border-t border-outline/5">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent Wallet</p>
                          <p className="text-[11px] font-mono text-gray-500 break-all">{selectedTx.agentWallet}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 italic py-4">Waiting for agent to accept...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Transaction Status
                </h4>
                <div className="flex items-center gap-4 bg-gray-50 p-6 rounded-3xl border border-outline/5">
                  <StatusBadge status={selectedTx.status} />
                  <div className="h-4 w-[1px] bg-gray-200" />
                  <p className="text-xs font-medium text-gray-500">
                    {selectedTx.status === "processing" ? "Agent has received VND and is paying out PHP." : 
                     selectedTx.status === "funded" ? "Waiting for sender to complete VND payment." :
                     selectedTx.status === "completed" ? "Successfully delivered to your bank account." :
                     "Status update in progress..."}
                  </p>
                </div>
              </div>

              {/* Payout Proof Section */}
              {selectedTx.agentProofRef && (
                <div className="space-y-6">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Agent Payment Proof
                  </h4>
                  <div className="bg-gray-50 p-6 rounded-3xl border border-outline/5">
                    <p className="text-xs text-gray-500 mb-4 font-medium">The agent has uploaded this receipt of your PHP transfer:</p>
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-outline/10 bg-white group">
                      <img 
                        src={selectedTx.agentProofRef} 
                        alt="Payment Proof" 
                        className="w-full h-full object-contain cursor-zoom-in transition-transform duration-500 group-hover:scale-105" 
                        onClick={() => window.open(selectedTx.agentProofRef!, "_blank")}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 text-center uppercase tracking-widest font-bold">Click image to expand</p>
                  </div>
                </div>
              )}

              {/* Action */}
              {selectedTx.status === "payout_submitted" && (
                <div className="pt-4">
                  <button
                    onClick={() => handleReceiverConfirm(selectedTx.txId)}
                    disabled={confirmingId === selectedTx.txId}
                    className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-bold shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                  >
                    {confirmingId === selectedTx.txId ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Signing on Stellar...</>
                    ) : (
                      <><ShieldCheck className="w-5 h-5" /> Confirm PHP Received</>
                    )}
                  </button>
                  <p className="text-[10px] text-gray-400 text-center mt-4 uppercase tracking-[0.1em] font-medium px-10">
                    Confirming will release the Agent's USDC collateral. Only click if you have actually received the PHP in your bank.
                  </p>
                </div>
              )}

              {selectedTx.stellarTxHash && selectedTx.status === "completed" && (
                <a 
                  href={`https://stellar.expert/explorer/testnet/tx/${selectedTx.stellarTxHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full h-16 bg-gray-900 text-white rounded-3xl font-bold flex items-center justify-center gap-3 transition-all hover:bg-black"
                >
                  <ExternalLink className="w-5 h-5" /> View on Blockchain
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.expired;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border", cfg.color)}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}
