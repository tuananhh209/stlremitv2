"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { RemittanceRecord, AgentBalanceResponse } from "@/lib/types";
import { useWallet } from "@/components/wallet-provider";
import { WalletMenu } from "@/components/wallet-menu";
import { useProfile } from "@/lib/hooks/use-profile";
import { BankInfoGuard } from "@/components/bank-info-guard";
import { QrUpload } from "@/components/qr-upload";
import {
  LayoutDashboard,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  TrendingUp,
  RefreshCw,
  Activity,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Zap,
  Inbox,
  User,
  CreditCard,
  Globe2,
  Settings,
  Building2,
  Save,
  Loader2,
  QrCode,
  X,
  Banknote,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Countdown Timer ───────────────────────────────────────────────────────────
function CountdownTimer({ expiresAt, status }: { expiresAt: string; status: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (status === "completed" || status === "expired" || status === "pending_agent") return;
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [status, remaining]);

  if (status === "completed" || status === "expired" || status === "pending_agent") return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 60;

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border",
      remaining === 0 ? "bg-red-50 text-red-600 border-red-100" :
      isUrgent ? "bg-amber-50 text-amber-600 border-amber-100 animate-pulse" :
      "bg-gray-50 text-gray-600 border-gray-100"
    )}>
      <Clock className="w-3 h-3" />
      {remaining === 0 ? "Expired" : `${mins}:${String(secs).padStart(2, "0")}`}
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_agent: { label: "Awaiting Accept", color: "text-indigo-600 bg-indigo-50 border-indigo-100", icon: Activity },
  cancelled:     { label: "Cancelled",       color: "text-gray-400 bg-gray-50 border-gray-100",      icon: AlertCircle },
  funded:        { label: "Waiting VND",     color: "text-amber-600 bg-amber-50 border-amber-100",   icon: Clock },
  processing:    { label: "Pay PHP Now",     color: "text-blue-600 bg-blue-50 border-blue-100",      icon: Zap },
  payout_submitted: { label: "Wait Receiver", color: "text-indigo-600 bg-indigo-50 border-indigo-100", icon: Activity },
  completed:     { label: "Completed",       color: "text-emerald-600 bg-emerald-50 border-emerald-100", icon: CheckCircle2 },
  expired:       { label: "Expired",         color: "text-gray-400 bg-gray-50 border-gray-100",      icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.funded;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border", cfg.color)}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
type NavTab = "overview" | "requests" | "history" | "pools" | "settings";

export default function AgentDashboard() {
  const router = useRouter();
  const { address, role, sign } = useWallet();
  const { isBankInfoComplete, loading: profileLoading, refetch: refetchProfile } = useProfile();

  // Role guard
  useEffect(() => {
    if (role && role !== "agent") {
      router.replace("/");
    }
  }, [role, router]);
  const [recentRemittances, setRecentRemittances] = useState<RemittanceRecord[]>([]);
  const [allRemittances, setAllRemittances] = useState<RemittanceRecord[]>([]);
  const [balance, setBalance] = useState<AgentBalanceResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load cache on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const r = localStorage.getItem("stl_recent");
        const h = localStorage.getItem("stl_history");
        const b = localStorage.getItem("stl_balance");
        if (r) { setRecentRemittances(JSON.parse(r)); setActivityLoading(false); }
        if (h) { setAllRemittances(JSON.parse(h)); setHistoryLoading(false); }
        if (b) setBalance(JSON.parse(b));
      } catch (e) { console.error("Cache load error", e); }
    }
  }, []);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [activeNav, setActiveNav] = useState<NavTab>("requests");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Settings state
  const [settingsBankName, setSettingsBankName] = useState("");
  const [settingsAccountNumber, setSettingsAccountNumber] = useState("");
  const [settingsAccountHolder, setSettingsAccountHolder] = useState("");
  const [settingsQrUrl, setSettingsQrUrl] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  
  // Payout Modal State
  const [payoutTx, setPayoutTx] = useState<RemittanceRecord | null>(null);
  const [payoutProofUrl, setPayoutProofUrl] = useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [receiverProfile, setReceiverProfile] = useState<any | null>(null);
  const [loadingReceiver, setLoadingReceiver] = useState(false);

  const AGENT_BANKS = ["Vietcombank", "Techcombank", "BIDV", "VPBank", "MB Bank", "ACB", "Sacombank", "TPBank"];

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/balance", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setBalance(d);
        try { localStorage.setItem("stl_balance", JSON.stringify(d)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, []);

  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/remittance?limit=10", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setRecentRemittances(d.remittances ?? []);
        try { localStorage.setItem("stl_recent", JSON.stringify(d.remittances ?? [])); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setActivityLoading(false); }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/remittance", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setAllRemittances(d.remittances ?? []);
        try { localStorage.setItem("stl_history", JSON.stringify(d.remittances ?? [])); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, []);

  // Trigger timeout check every 30s to auto-refund expired transactions
  useEffect(() => {
    const checkTimeouts = () => fetch("/api/cron/check-timeouts", { method: "POST" }).catch(() => {});
    checkTimeouts(); // run immediately on mount
    const id = setInterval(checkTimeouts, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchRecentActivity();
    
    // Poll balance and recent activity frequently
    const bId = setInterval(fetchBalance, 3000);
    const aId = setInterval(fetchRecentActivity, 5000);

    // Fetch history less frequently or when tab is active
    const hId = setInterval(fetchAll, 15000);
    fetchAll();

    const onVisible = () => { 
      if (document.visibilityState === "visible") {
        fetchBalance();
        fetchRecentActivity();
      } 
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(bId);
      clearInterval(aId);
      clearInterval(hId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchBalance, fetchRecentActivity, fetchAll]);

  // Load profile when settings tab opens
  useEffect(() => {
    if (activeNav !== "settings" || !address) return;
    setSettingsLoading(true);
    fetch(`/api/profile?wallet=${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setSettingsBankName(data.agentBankName ?? "");
          setSettingsAccountNumber(data.agentAccountNumber ?? "");
          setSettingsAccountHolder(data.agentAccountHolder ?? "");
          setSettingsQrUrl(data.agentQrImageUrl ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, [activeNav, address]);

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
          role: "agent",
          agentBankName: settingsBankName || null,
          agentAccountNumber: settingsAccountNumber || null,
          agentAccountHolder: settingsAccountHolder || null,
          agentQrImageUrl: settingsQrUrl || null,
        }),
      });
      if (res.ok) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000); refetchProfile(); }
      else { const d = await res.json(); setSettingsError(d.error ?? "Failed to save"); }
    } catch { setSettingsError("Network error"); }
    finally { setSettingsSaving(false); }
  };

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0 || !address) return;
    setDepositLoading(true);
    try {
      // Step 1: Build unsigned transaction XDR on server
      const buildRes = await fetch("/api/agent/build-fund-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: address, usdcAmount: amount }),
      });
      if (!buildRes.ok) {
        const d = await buildRes.json();
        alert(`Failed to build transaction: ${d.error}`);
        return;
      }
      const { xdr } = await buildRes.json();

      // Step 2: Sign with connected wallet (Freighter / Rabet)
      let signedXdr: string;
      try {
        signedXdr = await sign(xdr, "TESTNET");
      } catch (err: any) {
        alert(`Wallet signing cancelled or failed: ${err?.message ?? err}`);
        return;
      }

      // Step 3: Submit signed transaction
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

      // Step 4: Update DB balance
      await fetch("/api/agent/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usdcAmount: amount }),
      });

      setDepositAmount("");
      fetchAll();
    } catch (err: any) {
      alert(`Error: ${err?.message ?? "Unknown error"}`);
    } finally {
      setDepositLoading(false);
    }
  }

  async function handleAccept(txId: string) {
    if (!address) return;
    setAcceptingId(txId);
    try {
      // Step 1: Build unsigned accept tx (locks USDC for this specific request)
      const buildRes = await fetch("/api/agent/build-accept-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId, agentPublicKey: address }),
      });
      if (!buildRes.ok) {
        const d = await buildRes.json();
        alert(`Failed to build transaction: ${d.error}`);
        return;
      }
      const { xdr } = await buildRes.json();

      // Step 2: Agent signs with wallet (Freighter/Rabet popup)
      let signedXdr: string;
      try {
        signedXdr = await sign(xdr, "TESTNET");
      } catch (err: any) {
        alert(`Signing cancelled: ${err?.message ?? err}`);
        return;
      }

      // Step 3: Submit signed tx to Stellar
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

      // Step 4: Update DB — status → funded, start 5-min timer
      const acceptRes = await fetch(`/api/remittance/${txId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stellarTxHash: txHash, agentWallet: address }),
      });
      if (acceptRes.ok) fetchAll();
      else {
        const d = await acceptRes.json();
        alert(`DB update failed: ${d.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err?.message ?? "Unknown error"}`);
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleConfirmPayout(tx: RemittanceRecord) {
    setPayoutTx(tx);
    setPayoutProofUrl(null);
    setReceiverProfile(null);
    
    if (tx.receiverWallet) {
      setLoadingReceiver(true);
      fetch(`/api/profile?wallet=${tx.receiverWallet}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => setReceiverProfile(data))
        .catch(() => {})
        .finally(() => setLoadingReceiver(false));
    }
  }

  async function handleSubmitPayout() {
    if (!payoutTx || !payoutProofUrl) return;
    setPayoutLoading(true);
    try {
      const res = await fetch(`/api/remittance/${payoutTx.txId}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentProofRef: payoutProofUrl }),
      });
      if (res.ok) {
        setPayoutTx(null);
        fetchAll();
      } else {
        const d = await res.json();
        alert(d.error ?? "Failed to submit payout");
      }
    } catch {
      alert("Network error");
    } finally {
      setPayoutLoading(false);
    }
  }

  const pendingRequests  = allRemittances.filter(r => r.status === "pending_agent");
  const activeRemittances = allRemittances.filter(r => ["funded", "processing", "payout_submitted"].includes(r.status));
  const historyRemittances = allRemittances.filter(r => r.status === "completed" || r.status === "expired");

  const navItems: { id: NavTab; label: string; icon: any; badge?: number }[] = [
    { id: "requests", label: "Requests",  icon: Inbox,          badge: pendingRequests.length },
    { id: "overview", label: "Overview",  icon: LayoutDashboard },
    { id: "history",  label: "History",   icon: Clock },
    { id: "pools",    label: "Pools",     icon: Wallet },
    { id: "settings", label: "Settings",  icon: Settings },
  ];

  return (
    <main className="min-h-screen bg-[#f9f9ff] flex">
      {/* ── Sidebar ── */}
      <aside className="w-72 bg-white border-r border-outline/5 p-8 flex-col gap-10 hidden xl:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-[20px] flex items-center justify-center shadow-lg shadow-indigo-100">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900 tracking-tight">Agent Panel</span>
        </div>

        <nav className="flex flex-col gap-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-2xl font-bold text-sm transition-all",
                activeNav === item.id ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-gray-400 hover:bg-gray-50"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-6 bg-indigo-50 rounded-[32px] border border-indigo-100">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Agent Verified</span>
          </div>
          <p className="text-[10px] text-indigo-600/70 leading-relaxed font-medium">
            Accept requests to lock USDC. Confirm payouts to release collateral.
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-outline/5 px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeNav}</h1>
            {activeNav === "requests" && pendingRequests.length > 0 && (
              <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                {pendingRequests.length} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-6">
            <button onClick={fetchAll} className="p-3 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-outline/5">
              <RefreshCw className="w-5 h-5 text-gray-400" />
            </button>
            <WalletMenu />
          </div>
        </header>

        <div className="p-8 lg:p-12 space-y-10 overflow-y-auto max-w-7xl mx-auto w-full">

          {/* ── Stats Bar — only show when bank is set up ── */}
          {isBankInfoComplete("agent") && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[40px] premium-shadow border border-outline/5 flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available USDC</p>
                <p className="text-4xl font-bold text-gray-900">{balance?.availableUsdc.toFixed(2) ?? "0.00"}</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Active Pool</p>
              </div>
              <div className="w-16 h-16 bg-primary/5 rounded-[24px] flex items-center justify-center text-primary"><Wallet className="w-8 h-8" /></div>
            </div>
            <div className="bg-white p-8 rounded-[40px] premium-shadow border border-outline/5 flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reserved USDC</p>
                <p className="text-4xl font-bold text-gray-900">{balance?.reservedUsdc.toFixed(2) ?? "0.00"}</p>
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">In-Flight</p>
              </div>
              <div className="w-16 h-16 bg-amber-50 rounded-[24px] flex items-center justify-center text-amber-600"><Clock className="w-8 h-8" /></div>
            </div>
            <div className="bg-indigo-600 p-8 rounded-[40px] shadow-2xl shadow-indigo-100 text-white flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold uppercase tracking-widest text-white/70">Add Pool Liquidity</p>
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Plus className="w-6 h-6" /></div>
              </div>
              <form onSubmit={handleDeposit} className="flex gap-3 mt-4">
                <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="USDC amount..." className="bg-white/20 border-none rounded-2xl px-4 py-3 text-sm font-bold placeholder:text-white/40 focus:ring-4 focus:ring-white/10 w-full" />
                <button disabled={depositLoading} className="bg-white text-indigo-600 px-6 py-3 rounded-2xl font-bold text-xs hover:bg-white/90 transition-all disabled:opacity-50">
                  {depositLoading ? "..." : "Commit"}
                </button>
              </form>
            </div>
          </div>
          )} {/* end stats bar guard */}

          {/* ── BANK INFO GUARD ── */}
          {!isBankInfoComplete("agent") && activeNav !== "settings" && (
            <BankInfoGuard role="agent" onGoToSettings={() => setActiveNav("settings")} />
          )}

          {/* ── TAB: REQUESTS ── */}
          {activeNav === "requests" && isBankInfoComplete("agent") && (
            <div className="space-y-6">
              {pendingRequests.length === 0 ? (
                <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 py-32 flex flex-col items-center gap-4 text-gray-200">
                  <Inbox className="w-16 h-16" />
                  <p className="font-bold text-gray-400 text-lg">No pending requests</p>
                  <div className="flex items-center gap-2 text-xs text-gray-300 font-medium">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Listening for new requests...
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {pendingRequests.map(r => (
                    <div key={r.txId} className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-8 space-y-6 hover:border-indigo-200 transition-all">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Request</p>
                          <p className="text-xs font-mono text-gray-300">{r.txId.slice(0, 20)}...</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>

                      {/* Receiver info */}
                      <div className="bg-gray-50 rounded-3xl p-6 space-y-4 border border-outline/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{r.receiverName}</p>
                            <p className="text-xs text-gray-400 font-mono">{r.receiverAccount}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-outline/5">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">VND</p>
                            <p className="font-bold text-gray-900 text-sm">{r.vndAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">USDC Lock</p>
                            <p className="font-bold text-indigo-600 text-sm">{r.usdcEquivalent.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PHP Out</p>
                            <p className="font-bold text-emerald-600 text-sm">{r.phpPayout.toFixed(0)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Accept button */}
                      <button
                        onClick={() => handleAccept(r.txId)}
                        disabled={acceptingId === r.txId}
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[20px] font-bold text-sm shadow-lg shadow-indigo-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {acceptingId === r.txId ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Locking USDC...</>
                        ) : (
                          <><ShieldCheck className="w-5 h-5" /> Accept & Lock USDC <ArrowRight className="w-4 h-4" /></>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: OVERVIEW (active remittances) ── */}
          {activeNav === "overview" && isBankInfoComplete("agent") && (
            <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 overflow-hidden">
              <div className="px-10 py-8 border-b border-outline/5 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Active Remittances</h2>
                <div className="bg-gray-50 px-4 py-2 rounded-xl text-[10px] font-bold text-gray-400 uppercase tracking-widest">{activeRemittances.length} records</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <th className="px-10 py-5">Beneficiary</th>
                      <th className="px-10 py-5">Status</th>
                      <th className="px-10 py-5">Timer</th>
                      <th className="px-10 py-5 text-right">Payout</th>
                      <th className="px-10 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/5">
                    {activeRemittances.map(r => (
                      <tr key={r.txId} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-10 py-6">
                          <p className="text-sm font-bold text-gray-900">{r.receiverName}</p>
                          <p className="text-[10px] font-mono text-gray-300 mt-1">{r.txId.slice(0, 14)}...</p>
                        </td>
                        <td className="px-10 py-6"><StatusBadge status={r.status} /></td>
                        <td className="px-10 py-6"><CountdownTimer expiresAt={r.expiresAt} status={r.status} /></td>
                        <td className="px-10 py-6 text-right">
                          <p className="text-sm font-bold text-gray-900">{r.phpPayout.toLocaleString()} PHP</p>
                          <p className="text-xs text-emerald-600 font-bold mt-1">{r.vndAmount.toLocaleString()} VND</p>
                        </td>
                        <td className="px-10 py-6 text-right">
                          {r.status === "processing" ? (
                            <button
                              onClick={() => handleConfirmPayout(r)}
                              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-primary/10 flex items-center gap-2 ml-auto hover:scale-105 transition-all"
                            >
                              <Zap className="w-3.5 h-3.5" /> Confirm Payout
                            </button>
                          ) : (
                            <button
                              onClick={() => setExpandedId(expandedId === r.txId ? null : r.txId)}
                              className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1 ml-auto"
                            >
                              Details <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", expandedId === r.txId && "rotate-90")} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {activeRemittances.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-10 py-24 text-center">
                          <div className="flex flex-col items-center gap-4 text-gray-200">
                            <Search className="w-12 h-12" />
                            <p className="font-bold">No active remittances</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: HISTORY ── */}
          {activeNav === "history" && isBankInfoComplete("agent") && (
            <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 overflow-hidden">
              <div className="px-10 py-8 border-b border-outline/5">
                <h2 className="text-xl font-bold text-gray-900">Completed Transfers</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <th className="px-10 py-5">Date</th>
                      <th className="px-10 py-5">Beneficiary</th>
                      <th className="px-10 py-5">Volume</th>
                      <th className="px-10 py-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/5">
                    {historyRemittances.map(r => (
                      <tr key={r.txId} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-10 py-6 text-sm font-bold text-gray-900">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="px-10 py-6 text-sm font-bold text-gray-900">{r.receiverName}</td>
                        <td className="px-10 py-6 text-sm font-bold text-gray-900">{r.usdcEquivalent.toFixed(2)} USDC</td>
                        <td className="px-10 py-6"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                    {historyRemittances.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-10 py-24 text-center text-gray-300 font-bold">No history yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: POOLS ── */}
          {activeNav === "pools" && isBankInfoComplete("agent") && (
            <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-12 space-y-12">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-indigo-50 rounded-[32px] flex items-center justify-center text-indigo-600"><Wallet className="w-10 h-10" /></div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Pool Management</h2>
                  <p className="text-gray-400 mt-1">Manage your collateral and reserved liquidity.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available for New Accepts</p>
                  <p className="text-6xl font-bold text-indigo-600 tracking-tighter">{balance?.availableUsdc.toFixed(2)} <span className="text-2xl font-medium text-gray-300">USDC</span></p>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-sm">This is the amount you can lock when accepting new sender requests.</p>
                </div>
                <div className="bg-gray-50 rounded-[40px] p-10 space-y-6 border border-outline/5 shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reserved (Locked)</span>
                    <span className="font-bold text-amber-600">{balance?.reservedUsdc.toFixed(2)} USDC</span>
                  </div>
                  <div className="h-[1px] bg-outline/10" />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Committed (Lifetime)</span>
                    <span className="font-bold text-gray-900">{balance?.historicalVolume.toFixed(2)} USDC</span>
                  </div>
                  <button onClick={() => setActiveNav("overview")} className="w-full btn-primary h-14 rounded-2xl text-xs font-bold">View Active Reserves</button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: SETTINGS ── */}
          {activeNav === "settings" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-400 mt-1">Your Vietnamese bank account — senders will transfer VND here.</p>
              </div>

              {settingsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
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
                          className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-indigo-200 transition-all"
                        >
                          <option value="">Select bank...</option>
                          {AGENT_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
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
                          className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-indigo-200 transition-all"
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
                          className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-indigo-200 transition-all"
                        />
                      </div>

                      {/* QR Upload */}
                      {address && (
                        <QrUpload
                          currentUrl={settingsQrUrl}
                          walletAddress={address}
                          field="agentQr"
                          label="Bank QR Code (senders will scan this)"
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
                      className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[24px] font-bold text-sm shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-50 transition-all"
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
                      <div className="bg-indigo-600 px-8 pt-8 pb-6">
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Agent Bank Account</p>
                        <p className="text-2xl font-bold text-white">
                          {settingsBankName || <span className="text-white/30">Bank name</span>}
                        </p>
                      </div>
                      <div className="p-8 space-y-6">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <CreditCard className="w-3 h-3" /> Account Number
                          </p>
                          <p className={cn("text-2xl font-mono font-bold tracking-wider", settingsAccountNumber ? "text-gray-900" : "text-gray-200")}>
                            {settingsAccountNumber || "0000 0000 000"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <User className="w-3 h-3" /> Account Holder
                          </p>
                          <p className={cn("text-lg font-bold", settingsAccountHolder ? "text-gray-900" : "text-gray-200")}>
                            {settingsAccountHolder || "Full name"}
                          </p>
                        </div>
                        {settingsQrUrl ? (
                          <div className="pt-4 border-t border-outline/5 flex flex-col items-center gap-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest self-start flex items-center gap-1.5">
                              <QrCode className="w-3 h-3" /> QR Code
                            </p>
                            <img src={settingsQrUrl} alt="Agent Bank QR" className="w-44 h-44 object-contain rounded-2xl border border-outline/10 bg-gray-50 p-2" />
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

      {/* ── PAYOUT MODAL ── */}
      {payoutTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            {/* Modal Header */}
            <div className="p-8 border-b border-outline/5 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <Banknote className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Confirm PHP Payout</h3>
                  <p className="text-[10px] text-gray-400 font-mono tracking-wider">{payoutTx.txId}</p>
                </div>
              </div>
              <button onClick={() => setPayoutTx(null)} className="p-3 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-10 space-y-10 overflow-y-auto max-h-[75vh]">
              
              {/* Receiver Account Section */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Receiver Destination
                </h4>
                <div className="bg-emerald-50/50 rounded-[32px] p-8 border border-emerald-100/30 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Payout Amount</p>
                      <p className="text-3xl font-bold text-emerald-700">{payoutTx.phpPayout.toLocaleString()} PHP</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Receiver Name</p>
                      <p className="text-lg font-bold text-emerald-900">{payoutTx.receiverName}</p>
                    </div>
                  </div>
                  <div className="space-y-4 bg-white/50 rounded-2xl p-6 border border-emerald-100/20">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bank / Account</p>
                      <p className="text-sm font-bold text-gray-900">
                        {loadingReceiver ? "Loading..." : receiverProfile?.bankName || "See Account No."}
                      </p>
                      <p className="text-lg font-mono font-bold text-indigo-600 mt-1">{payoutTx.receiverAccount}</p>
                    </div>
                    {receiverProfile?.accountHolder && (
                      <div className="space-y-1 pt-2 border-t border-emerald-100/30">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Holder Name</p>
                        <p className="text-xs font-bold text-gray-700">{receiverProfile.accountHolder}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload Proof */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Payment Proof
                </h4>
                <div className="bg-gray-50 rounded-[32px] p-8 border border-outline/5">
                  <QrUpload 
                    currentUrl={payoutProofUrl}
                    walletAddress={address!}
                    field="agentQr"
                    label="Upload Transfer Receipt"
                    onUploaded={(url) => setPayoutProofUrl(url || null)}
                  />
                  <p className="text-[10px] text-gray-400 text-center mt-6 uppercase tracking-wider font-medium">
                    Upload a screenshot of your PHP transfer confirmation
                  </p>
                </div>
              </div>

              {/* Confirm Action */}
              <button
                disabled={!payoutProofUrl || payoutLoading}
                onClick={handleSubmitPayout}
                className="w-full h-20 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[28px] font-bold text-lg shadow-2xl shadow-indigo-100 flex items-center justify-center gap-4 transition-all disabled:opacity-50 disabled:grayscale"
              >
                {payoutLoading ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> Updating Status...</>
                ) : (
                  <><CheckCircle2 className="w-6 h-6" /> Confirm Payout Sent</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
