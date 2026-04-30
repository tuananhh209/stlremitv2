"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { calculateAmounts, EXCHANGE_RATES } from "@/lib/config";
import { useWallet } from "@/components/wallet-provider";
import { WalletMenu } from "@/components/wallet-menu";
import { useProfile } from "@/lib/hooks/use-profile";
import { BankInfoGuard } from "@/components/bank-info-guard";
import { QrUpload } from "@/components/qr-upload";
import {
  LayoutDashboard,
  History as HistoryIcon,
  Wallet,
  Send,
  ArrowRight,
  ArrowUpRight,
  Search,
  ShieldCheck,
  Globe2,
  User,
  CreditCard,
  Banknote,
  Activity,
  Settings,
  Building2,
  Save,
  CheckCircle2,
  Loader2,
  QrCode,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = "overview" | "history" | "pools" | "settings";

const STATUS_COLORS: Record<string, string> = {
  pending_agent: "bg-indigo-50 text-indigo-600",
  funded:        "bg-amber-50 text-amber-600",
  processing:    "bg-blue-50 text-blue-600",
  completed:     "bg-emerald-50 text-emerald-600",
  expired:       "bg-red-50 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending_agent: "Waiting Agent",
  funded:        "Pay Now",
  processing:    "Processing",
  completed:     "Completed",
  expired:       "Expired",
};

export default function SenderDashboard() {
  const router = useRouter();
  const { address, isConnected, role } = useWallet();
  const { isBankInfoComplete, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Role guard — if wrong role, redirect to root
  useEffect(() => {
    if (isConnected && role && role !== "sender") {
      router.replace("/");
    }
  }, [isConnected, role, router]);

  // Form State
  const [vndAmount, setVndAmount] = useState<string>("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");
  const [receiverWallet, setReceiverWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time Data — init from localStorage cache for instant display
  const [availableUsdc, setAvailableUsdc] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try { return JSON.parse(localStorage.getItem("stl_balance") ?? "null")?.availableUsdc ?? 0; } catch { return 0; }
  });
  const [totalCollateral, setTotalCollateral] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try { return JSON.parse(localStorage.getItem("stl_balance") ?? "null")?.totalCollateral ?? 0; } catch { return 0; }
  });
  const [reservedUsdc, setReservedUsdc] = useState<number>(0);
  const [historicalVolume, setHistoricalVolume] = useState<number>(0);

  // Settings state
  const [settingsBankName, setSettingsBankName] = useState("");
  const [settingsAccountNumber, setSettingsAccountNumber] = useState("");
  const [settingsAccountHolder, setSettingsAccountHolder] = useState("");
  const [settingsQrUrl, setSettingsQrUrl] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const SENDER_BANKS = ["Vietcombank", "Techcombank", "BIDV", "VPBank", "MB Bank", "ACB", "Sacombank", "TPBank"];

  const parsedAmount = parseFloat(vndAmount);
  const amounts = !isNaN(parsedAmount) && parsedAmount > 0 ? calculateAmounts(parsedAmount) : null;

  const [recentRemittances, setRecentRemittances] = useState<any[]>([]);
  const [allRemittances, setAllRemittances] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/balance", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAvailableUsdc(data.availableUsdc);
        setTotalCollateral(data.totalCollateral);
        setReservedUsdc(data.reservedUsdc ?? 0);
        setHistoricalVolume(data.historicalVolume ?? 0);
        // Cache for instant display on next load
        try { localStorage.setItem("stl_balance", JSON.stringify(data)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, []);

  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/remittance?limit=5&sender=${address || ""}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRecentRemittances(data.remittances ?? []);
        try { localStorage.setItem("stl_recent", JSON.stringify(data.remittances ?? [])); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setActivityLoading(false); }
  }, []);

  const fetchAllHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/remittance?sender=${address || ""}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAllRemittances(data.remittances ?? []);
        try { localStorage.setItem("stl_history", JSON.stringify(data.remittances ?? [])); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, []);

  // Balance: poll every 15s (Stellar RPC is slow, cached on server for 10s)
  useEffect(() => {
    fetchBalance();
    const id = setInterval(fetchBalance, 15000);
    return () => clearInterval(id);
  }, [fetchBalance]);

  // Recent activity: poll every 3s
  useEffect(() => {
    fetchRecentActivity();
    const id = setInterval(fetchRecentActivity, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchRecentActivity(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetchRecentActivity]);

  // History: load on demand + every 30s
  useEffect(() => {
    if (activeTab === "history" || activeTab === "overview") {
      fetchAllHistory();
    }
    const id = setInterval(fetchAllHistory, 30000);
    return () => clearInterval(id);
  }, [fetchAllHistory, activeTab]);

  // Load profile when settings tab opens
  useEffect(() => {
    if (activeTab !== "settings" || !address) return;
    setSettingsLoading(true);
    fetch(`/api/profile?wallet=${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setSettingsBankName(data.bankName ?? "");
          setSettingsAccountNumber(data.accountNumber ?? "");
          setSettingsAccountHolder(data.accountHolder ?? "");
          setSettingsQrUrl(data.qrImageUrl ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, [activeTab, address]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          role: "sender",
          bankName: settingsBankName || null,
          accountNumber: settingsAccountNumber || null,
          accountHolder: settingsAccountHolder || null,
          qrImageUrl: settingsQrUrl || null,
        }),
      });
      if (res.ok) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000); refetchProfile(); }
      else { const d = await res.json(); setSettingsError(d.error ?? "Failed to save"); }
    } catch { setSettingsError("Network error"); }
    finally { setSettingsSaving(false); }
  };

  const handleStartRemittance = async () => {
    if (!amounts || !receiverName || !receiverAccount || !receiverWallet) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/remittance/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          vndAmount: parsedAmount, 
          receiverName, 
          receiverAccount, 
          receiverWallet,
          senderWallet: address,
          senderName: "Sender"
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Always redirect to tx page — status will be pending_agent
        router.push(`/tx/${data.txId}`);
      } else {
        setError(data.error ?? "Failed to create request");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f9f9ff] flex">
      {/* ── Sidebar ── */}
      <aside className="w-72 bg-white border-r border-outline/5 p-8 flex-col gap-10 hidden xl:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Globe2 className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900 tracking-tight">STL Remit</span>
        </div>

        <nav className="flex flex-col gap-2">
          {(["overview", "history", "pools", "settings"] as Tab[]).map((tab) => {
            const icons: Record<Tab, any> = {
              overview: LayoutDashboard,
              history: HistoryIcon,
              pools: Activity,
              settings: Settings,
            };
            const Icon = icons[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-2xl font-bold text-sm transition-all capitalize",
                  activeTab === tab ? "bg-primary/5 text-primary shadow-sm" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                )}
              >
                <Icon className="w-5 h-5" />{tab}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto bg-gray-900 rounded-[32px] p-6 text-white space-y-4 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-primary/20 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Secure Escrow</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Funds are protected by a Soroban smart contract. Agent must lock USDC before you pay.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-outline/5 px-8 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeTab}</h1>
            <p className="text-xs text-gray-400 font-medium mt-1">Stellar Blockchain · Testnet</p>
          </div>
          {isConnected && <WalletMenu />}
        </header>

        <div className="p-8 lg:p-12 space-y-10 overflow-y-auto max-w-7xl mx-auto w-full">

          {/* ── BANK INFO GUARD ── */}
          {!isBankInfoComplete("sender") && activeTab !== "settings" && (
            <BankInfoGuard role="sender" onGoToSettings={() => setActiveTab("settings")} />
          )}

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && isBankInfoComplete("sender") && (
            <div className="flex flex-col xl:flex-row gap-10">
              {/* Left: Form */}
              <div className="flex-1 space-y-8">
                <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-10 lg:p-16">
                  <div className="space-y-12">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">New Remittance</h2>
                        <p className="text-sm text-gray-400">Send VND to Philippines via escrow-protected transfer.</p>
                      </div>
                      <div className="w-14 h-14 bg-primary/5 rounded-[20px] flex items-center justify-center text-primary">
                        <Banknote className="w-7 h-7" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-12">
                      {/* Amount */}
                      <div className="space-y-8">
                        <div className="relative group">
                          <label className="absolute left-7 top-5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] group-focus-within:text-primary transition-colors">
                            VND Amount
                          </label>
                          <input
                            type="number"
                            value={vndAmount}
                            onChange={(e) => setVndAmount(e.target.value)}
                            placeholder="0"
                            className="w-full bg-gray-50 border-none rounded-[40px] px-10 pt-20 pb-12 text-6xl font-bold text-gray-900 focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-gray-200"
                          />
                          <div className="absolute right-10 top-1/2 -translate-y-1/2 bg-white px-6 py-3 rounded-2xl shadow-sm border border-outline/5 font-bold text-lg">VND</div>
                        </div>

                        {amounts && (
                          <div className="bg-emerald-50/50 rounded-3xl p-8 border border-emerald-100/50 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Recipient Gets</span>
                              <span className="text-2xl font-bold text-emerald-700">{amounts.phpPayout.toLocaleString()} PHP</span>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-emerald-100/30">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">USDC to Lock</span>
                              <span className="text-lg font-bold text-emerald-700">{amounts.usdcEquivalent.toFixed(4)} USDC</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Receiver */}
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">Receiver Full Name</label>
                          <div className="relative">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                            <input
                              type="text"
                              value={receiverName}
                              onChange={(e) => setReceiverName(e.target.value)}
                              placeholder="Juan Dela Cruz"
                              className="w-full bg-gray-50 border-none rounded-2xl pl-16 pr-8 py-6 text-lg font-bold text-gray-900 focus:ring-4 focus:ring-primary/5 transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">GCash / Account No.</label>
                          <div className="relative">
                            <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                            <input
                              type="text"
                              value={receiverAccount}
                              onChange={(e) => setReceiverAccount(e.target.value)}
                              placeholder="09XXXXXXXXX"
                              className="w-full bg-gray-50 border-none rounded-2xl pl-16 pr-8 py-6 text-lg font-bold text-gray-900 focus:ring-4 focus:ring-primary/5 transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">Receiver Stellar Wallet</label>
                          <div className="relative">
                            <Wallet className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                            <input
                              type="text"
                              value={receiverWallet}
                              onChange={(e) => setReceiverWallet(e.target.value.trim())}
                              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                              className="w-full bg-gray-50 border-none rounded-2xl pl-16 pr-8 py-6 text-xs font-mono text-gray-900 focus:ring-4 focus:ring-primary/5 transition-all"
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 ml-3">Ask receiver for their Stellar wallet address</p>
                        </div>

                        <button
                          disabled={!amounts || !receiverName || !receiverAccount || !receiverWallet || loading}
                          onClick={handleStartRemittance}
                          className="w-full btn-primary h-16 rounded-[24px] font-bold text-sm shadow-xl shadow-primary/20 flex items-center justify-center gap-3 mt-4 disabled:opacity-50"
                        >
                          {loading ? (
                            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending Request...</>
                          ) : (
                            <>Send Request <ArrowRight className="w-5 h-5" /></>
                          )}
                        </button>
                        {error && <p className="text-center text-xs text-red-500 font-bold mt-2">⚠️ {error}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-[32px] premium-shadow border border-outline/5 space-y-4">
                    <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary"><Wallet className="w-6 h-6" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent Pool</p>
                      <p className="text-2xl font-bold text-gray-900">{availableUsdc.toFixed(2)} <span className="text-sm font-medium text-gray-300">USDC</span></p>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-[32px] premium-shadow border border-outline/5 space-y-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600"><Send className="w-6 h-6" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active</p>
                      <p className="text-2xl font-bold text-gray-900">{allRemittances.filter(r => ["pending_agent","funded","processing"].includes(r.status)).length}</p>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-[32px] premium-shadow border border-outline/5 space-y-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><HistoryIcon className="w-6 h-6" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Completed</p>
                      <p className="text-2xl font-bold text-gray-900">{allRemittances.filter(r => r.status === "completed").length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Recent activity */}
              <div className="xl:w-[450px] space-y-8">
                <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">Recent Activity</h3>
                    <button onClick={() => setActiveTab("history")} className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">View All</button>
                  </div>
                  <div className="space-y-4">
                    {recentRemittances.map((r) => (
                      <div
                        key={r.txId}
                        onClick={() => router.push(`/tx/${r.txId}`)}
                        className="p-5 bg-gray-50 rounded-3xl border border-transparent hover:border-primary/20 hover:bg-white transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn("px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest", STATUS_COLORS[r.status] ?? "bg-gray-50 text-gray-400")}>
                            {STATUS_LABELS[r.status] ?? r.status}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="font-bold text-gray-900 group-hover:text-primary transition-colors">{r.receiverName}</p>
                        <p className="text-xs text-gray-400 mt-1">{Number(r.vndAmount).toLocaleString()} VND → {Number(r.phpPayout).toFixed(0)} PHP</p>
                      </div>
                    ))}
                    {activityLoading ? (
                      <div className="py-10 flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading activity...</p>
                      </div>
                    ) : recentRemittances.length === 0 ? (
                      <div className="py-10 text-center space-y-3">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200"><HistoryIcon className="w-6 h-6" /></div>
                        <p className="text-xs text-gray-400 font-medium">No activity yet</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="bg-indigo-600 rounded-[40px] p-8 text-white space-y-6 relative overflow-hidden">
                  <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                  <div className="relative z-10">
                    <h3 className="font-bold text-lg">Exchange Rates</h3>
                    <div className="mt-4 space-y-3">
                      <div className="flex justify-between items-center text-sm font-medium border-b border-white/10 pb-3">
                        <span className="text-white/60">1 USDC</span>
                        <span>{EXCHANGE_RATES.USDC_TO_PHP} PHP</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-medium pt-1">
                        <span className="text-white/60">1 USDC</span>
                        <span>{Math.round(1 / EXCHANGE_RATES.VND_TO_USDC).toLocaleString()} VND</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === "history" && isBankInfoComplete("sender") && (
            <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 overflow-hidden">
              <div className="p-10 border-b border-outline/5 flex items-center justify-between bg-gray-50/30">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
                  <p className="text-sm text-gray-400 mt-1">All your remittance records.</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-outline/5 shadow-sm min-w-[280px]">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search by name or ID..." className="bg-transparent border-none text-sm font-medium focus:ring-0 w-full" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                      <th className="px-10 py-6">Date / ID</th>
                      <th className="px-10 py-6">Receiver</th>
                      <th className="px-10 py-6">Amount</th>
                      <th className="px-10 py-6">Status</th>
                      <th className="px-10 py-6 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/5">
                    {allRemittances.map((r) => (
                      <tr key={r.txId} className="hover:bg-gray-50/30 transition-colors group">
                        <td className="px-10 py-7">
                          <p className="text-sm font-bold text-gray-900">{new Date(r.createdAt).toLocaleDateString()}</p>
                          <p className="text-[10px] text-gray-300 font-mono mt-1">{r.txId.slice(0, 14)}...</p>
                        </td>
                        <td className="px-10 py-7">
                          <p className="text-sm font-bold text-gray-900">{r.receiverName}</p>
                          <p className="text-xs text-gray-400 mt-1">{r.receiverAccount}</p>
                        </td>
                        <td className="px-10 py-7">
                          <p className="text-sm font-bold text-gray-900">{Number(r.vndAmount).toLocaleString()} VND</p>
                          <p className="text-xs text-emerald-600 font-bold mt-1">{Number(r.phpPayout).toFixed(2)} PHP</p>
                        </td>
                        <td className="px-10 py-7">
                          <span className={cn("inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider", STATUS_COLORS[r.status] ?? "bg-gray-50 text-gray-400")}>
                            {STATUS_LABELS[r.status] ?? r.status}
                          </span>
                        </td>
                        <td className="px-10 py-7 text-right">
                          <button onClick={() => router.push(`/tx/${r.txId}`)} className="p-3 bg-gray-50 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {historyLoading ? (
                      <tr>
                        <td colSpan={5} className="px-10 py-32 text-center">
                          <div className="flex flex-col items-center gap-4 text-gray-300">
                            <Loader2 className="w-12 h-12 animate-spin text-primary" />
                            <p className="font-bold">Loading history...</p>
                          </div>
                        </td>
                      </tr>
                    ) : allRemittances.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-10 py-32 text-center">
                          <div className="flex flex-col items-center gap-4 text-gray-300">
                            <HistoryIcon className="w-12 h-12" />
                            <p className="font-bold">No transactions found</p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── POOLS TAB ── */}
          {activeTab === "pools" && isBankInfoComplete("sender") && (
            <div className="space-y-10">
              <div className="bg-primary rounded-[48px] p-16 text-white relative overflow-hidden shadow-2xl shadow-primary/20">
                <div className="absolute top-[-30%] right-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[120px]" />
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                  <div className="space-y-8">
                    <div className="inline-flex items-center gap-3 px-5 py-2 bg-white/10 rounded-full backdrop-blur-md border border-white/10">
                      <ShieldCheck className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-[0.2em]">Escrow Protected Pool</span>
                    </div>
                    <div className="space-y-4">
                      <h2 className="text-5xl font-bold tracking-tight">Smart Contract<br />Liquidity</h2>
                      <p className="text-lg text-white/70 leading-relaxed max-w-md">
                        Real-time transparency of USDC locked in the Soroban smart contract.
                      </p>
                    </div>
                  </div>
                  <div className="bg-white rounded-[40px] p-10 text-gray-900 shadow-2xl space-y-10">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Committed</p>
                      <p className="text-6xl font-bold tracking-tighter text-primary">{historicalVolume.toFixed(2)} <span className="text-2xl font-medium text-gray-300">USDC</span></p>
                    </div>
                    <div className="h-[2px] bg-gray-50" />
                    <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Available</p>
                        <p className="text-3xl font-bold">{availableUsdc.toFixed(2)}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /> Reserved</p>
                        <p className="text-3xl font-bold">{reservedUsdc.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-[40px] premium-shadow border border-outline/5 space-y-6">
                  <h3 className="text-xl font-bold text-gray-900">How It Works</h3>
                  <div className="space-y-4">
                    {[
                      { title: "1. Send Request", desc: "You submit a remittance request. No payment yet." },
                      { title: "2. Agent Accepts", desc: "Agent reviews and locks USDC in the smart contract." },
                      { title: "3. Pay VND (5 min)", desc: "You transfer VND to agent's bank within 5 minutes." },
                      { title: "4. PHP Delivered", desc: "Agent pays PHP to receiver and confirms on-chain." },
                    ].map((s, i) => (
                      <div key={i} className="flex gap-5">
                        <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center font-bold text-gray-400 shrink-0 text-sm">{i + 1}</div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{s.title}</p>
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-10 rounded-[40px] premium-shadow border border-outline/5 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                    <Globe2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-gray-900">Decentralized Trust</h3>
                    <p className="text-xs text-gray-400 max-w-xs leading-relaxed mx-auto">
                      All pool operations are visible on-chain. No central authority holds your funds.
                    </p>
                  </div>
                  <button className="text-xs font-bold text-primary uppercase tracking-widest hover:underline flex items-center gap-2">
                    View Contract on Stellar Expert <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === "settings" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-400 mt-1">Your Vietnamese bank account for VND transfers.</p>
              </div>

              {settingsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">

                  {/* ── Left: Form ── */}
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-10 space-y-8">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" /> Vietnamese Bank
                        </label>
                        <select
                          value={settingsBankName}
                          onChange={e => setSettingsBankName(e.target.value)}
                          className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                          <option value="">Select bank...</option>
                          {SENDER_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" /> Account Number
                        </label>
                        <input
                          type="text"
                          value={settingsAccountNumber}
                          onChange={e => setSettingsAccountNumber(e.target.value)}
                          placeholder="0123456789"
                          className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Account Holder Name
                        </label>
                        <input
                          type="text"
                          value={settingsAccountHolder}
                          onChange={e => setSettingsAccountHolder(e.target.value)}
                          placeholder="Full name as on bank account"
                          className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>

                      {/* QR Upload */}
                      {address && (
                        <QrUpload
                          currentUrl={settingsQrUrl}
                          walletAddress={address}
                          field="qr"
                          label="Bank QR Code (optional)"
                          onUploaded={(url) => setSettingsQrUrl(url || null)}
                        />
                      )}
                    </div>

                    <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-8 space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Connected Wallet</p>
                      <p className="text-sm font-mono text-gray-700 break-all">{address}</p>
                    </div>

                    {settingsError && <p className="text-sm text-red-500 font-bold">⚠️ {settingsError}</p>}

                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="w-full btn-primary h-16 rounded-[24px] font-bold text-sm shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {settingsSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> :
                       settingsSaved  ? <><CheckCircle2 className="w-5 h-5" /> Saved!</> :
                       <><Save className="w-5 h-5" /> Save Settings</>}
                    </button>
                  </form>

                  {/* ── Right: Live Preview Card ── */}
                  <div className="sticky top-32 space-y-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Live Preview</p>
                    <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 overflow-hidden">
                      {/* Card header */}
                      <div className="bg-primary px-8 pt-8 pb-6">
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Bank Account</p>
                        <p className="text-2xl font-bold text-white">
                          {settingsBankName || <span className="text-white/30">Bank name</span>}
                        </p>
                      </div>

                      <div className="p-8 space-y-6">
                        {/* Account number */}
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <CreditCard className="w-3 h-3" /> Account Number
                          </p>
                          <p className={cn(
                            "text-2xl font-mono font-bold tracking-wider",
                            settingsAccountNumber ? "text-gray-900" : "text-gray-200"
                          )}>
                            {settingsAccountNumber || "0000 0000 000"}
                          </p>
                        </div>

                        {/* Account holder */}
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <User className="w-3 h-3" /> Account Holder
                          </p>
                          <p className={cn(
                            "text-lg font-bold",
                            settingsAccountHolder ? "text-gray-900" : "text-gray-200"
                          )}>
                            {settingsAccountHolder || "Full name"}
                          </p>
                        </div>

                        {/* QR preview */}
                        {settingsQrUrl ? (
                          <div className="pt-4 border-t border-outline/5 flex flex-col items-center gap-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest self-start flex items-center gap-1.5">
                              <QrCode className="w-3 h-3" /> QR Code
                            </p>
                            <img
                              src={settingsQrUrl}
                              alt="Bank QR"
                              className="w-44 h-44 object-contain rounded-2xl border border-outline/10 bg-gray-50 p-2"
                            />
                          </div>
                        ) : (
                          <div className="pt-4 border-t border-outline/5 flex flex-col items-center gap-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest self-start flex items-center gap-1.5">
                              <QrCode className="w-3 h-3" /> QR Code
                            </p>
                            <div className="w-44 h-44 rounded-2xl border-2 border-dashed border-outline/15 bg-gray-50 flex flex-col items-center justify-center gap-2 text-gray-300">
                              <QrCode className="w-10 h-10" />
                              <p className="text-xs font-medium">Upload QR to preview</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
