"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { RemittanceRecord, AgentBalanceResponse } from "@/lib/types";
import { useWallet } from "@/components/wallet-provider";
import {
  LayoutDashboard,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Search,
  Plus,
  Image as ImageIcon,
  LogOut,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

const STATUS_CONFIG = {
  funded: { label: "Pending VND", color: "text-amber-600 bg-amber-50 border-amber-100", icon: Clock },
  processing: { label: "Processing PHP", color: "text-blue-600 bg-blue-50 border-blue-100", icon: TrendingUp },
  completed: { label: "Completed", color: "text-emerald-600 bg-emerald-50 border-emerald-100", icon: CheckCircle2 },
  expired: { label: "Expired", color: "text-gray-500 bg-gray-50 border-gray-100", icon: AlertCircle },
} as const;

function StatusBadge({ status }: { status: RemittanceRecord["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calc = () => setRemaining(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${remaining < 60 && remaining > 0 ? "text-red-600 font-bold" : "text-gray-500"}`}>
      <Clock className="w-3 h-3" />
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

function ProofUploadModal({ txId, onClose, onSuccess }: { txId: string; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/remittance/${txId}/agent-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofImageBase64: base64, proofImageMimeType: file.type }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Upload failed");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("Upload error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Upload PHP Proof</h3>
          <p className="text-sm text-gray-500 mt-1">Upload screenshot of GCash/Bank transfer.</p>
        </div>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors cursor-pointer relative">
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
            <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-gray-900">{file ? file.name : "Click to select image"}</p>
            <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
          </div>
          {error && <p className="text-red-600 text-xs text-center">⚠️ {error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={!file || loading} className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50">
              {loading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const { address, disconnect } = useWallet();
  const [remittances, setRemittances] = useState<RemittanceRecord[]>([]);
  const [balance, setBalance] = useState<AgentBalanceResponse | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMsg, setDepositMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [proofModalId, setProofModalId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<"overview" | "history" | "pools">("overview");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [rRes, bRes] = await Promise.all([fetch("/api/remittance"), fetch("/api/agent/balance")]);
      if (rRes.ok) { const d = await rRes.json(); setRemittances(d.remittances ?? []); }
      if (bRes.ok) { const d = await bRes.json(); setBalance(d); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAll();
    pollingRef.current = setInterval(fetchAll, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchAll]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    setDepositLoading(true);
    setDepositMsg(null);
    try {
      const res = await fetch("/api/agent/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usdcAmount: amount }),
      });
      const data = await res.json();
      if (res.ok) {
        setDepositMsg({ type: "success", text: `Deposited! New balance: ${data.newBalance?.toFixed(4)} USDC` });
        setDepositAmount("");
        fetchAll();
      } else {
        setDepositMsg({ type: "error", text: data.error ?? "Deposit failed" });
      }
    } catch {
      setDepositMsg({ type: "error", text: "Connection error" });
    } finally {
      setDepositLoading(false);
      setTimeout(() => setDepositMsg(null), 4000);
    }
  }

  async function handleConfirm(txId: string) {
    setConfirmingId(txId);
    try {
      const res = await fetch(`/api/remittance/${txId}/confirm`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        alert(`Error: ${d.error}`);
        return;
      }
      fetchAll();
    } catch {
      alert("Connection error");
    } finally {
      setConfirmingId(null);
    }
  }

  const filteredRemittances = activeNav === "history"
    ? remittances.filter(r => r.status === "completed" || r.status === "expired")
    : activeNav === "overview"
    ? remittances
    : remittances;

  return (
    <main className="min-h-screen bg-[#f9f9ff] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 p-6 flex-col gap-8 hidden lg:flex">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900">STL Remit</span>
        </div>

        <nav className="flex flex-col gap-1">
          {[
            { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
            { id: "history" as const, label: "History", icon: Clock },
            { id: "pools" as const, label: "Pools", icon: Wallet },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeNav === id ? "bg-primary/5 text-primary" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Network</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-gray-700">Stellar Testnet</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 lg:hidden">Dashboard</h1>
            <div className="hidden lg:flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 min-w-[280px]">
              <Search className="w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search transactions..." className="bg-transparent border-none text-sm focus:ring-0 w-full text-gray-900 outline-none" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={fetchAll} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase">Agent</p>
                <p className="text-sm font-mono text-gray-900">{address?.slice(0, 4)}...{address?.slice(-4)}</p>
              </div>
              <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                {address?.[0]}
              </div>
            </div>
            <button
              onClick={disconnect}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8 overflow-y-auto">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl premium-shadow border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Available</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Available Collateral</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {balance?.availableUsdc.toFixed(2) ?? "—"} <span className="text-lg font-medium text-gray-400">USDC</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl premium-shadow border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Reserved</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Reserves</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {balance?.reservedUsdc.toFixed(2) ?? "—"} <span className="text-lg font-medium text-gray-400">USDC</span>
                </p>
              </div>
            </div>

            {/* Deposit Card */}
            <div className="bg-primary p-6 rounded-3xl premium-shadow relative overflow-hidden group">
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
              <div className="relative z-10 space-y-4">
                <p className="text-sm font-medium text-white/80">Add Liquidity</p>
                <form onSubmit={handleDeposit} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="USDC amount"
                      min="0.0001"
                      step="0.0001"
                      className="bg-white/20 text-white placeholder:text-white/50 rounded-xl text-sm w-full px-3 py-2 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <button
                      type="submit"
                      disabled={depositLoading || !depositAmount}
                      className="bg-white text-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors shrink-0 flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Plus className="w-4 h-4" />
                      {depositLoading ? "..." : "Add"}
                    </button>
                  </div>
                  {depositMsg && (
                    <p className={`text-xs font-medium ${depositMsg.type === "success" ? "text-white" : "text-red-200"}`}>
                      {depositMsg.type === "success" ? "✅" : "⚠️"} {depositMsg.text}
                    </p>
                  )}
                  {!depositMsg && <p className="text-[10px] text-white/60">Deposit USDC into the escrow pool</p>}
                </form>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-3xl premium-shadow border border-gray-100 overflow-hidden">
            <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-gray-900">
                  {activeNav === "history" ? "Transaction History" : activeNav === "pools" ? "Liquidity Pools" : "Active Remittances"}
                </h2>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                  {filteredRemittances.length}
                </span>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {activeNav === "pools" ? (
              <div className="p-8 space-y-4">
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">USDC Collateral Pool</h3>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Active</span>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Total</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{balance?.totalCollateral.toFixed(4) ?? "—"}</p>
                      <p className="text-xs text-gray-400">USDC</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Reserved</p>
                      <p className="text-2xl font-bold text-amber-600 mt-1">{balance?.reservedUsdc.toFixed(4) ?? "—"}</p>
                      <p className="text-xs text-gray-400">USDC</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Available</p>
                      <p className="text-2xl font-bold text-emerald-600 mt-1">{balance?.availableUsdc.toFixed(4) ?? "—"}</p>
                      <p className="text-xs text-gray-400">USDC</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                      <th className="px-8 py-4">Receiver / TX ID</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4 text-right">Amounts</th>
                      <th className="px-8 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredRemittances.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-gray-300">
                            <Search className="w-10 h-10" />
                            <p className="text-sm font-medium text-gray-400">No transactions found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRemittances.map((r) => (
                        <tr key={r.txId} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-8 py-5">
                            <p className="text-sm font-bold text-gray-900">{r.receiverName}</p>
                            <p className="text-xs font-mono text-gray-400 mt-0.5">{r.txId.slice(0, 14)}...</p>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col gap-1.5">
                              <StatusBadge status={r.status} />
                              {r.status === "funded" && <Countdown expiresAt={r.expiresAt} />}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <p className="text-sm font-bold text-gray-900">{r.vndAmount.toLocaleString()} VND</p>
                            <p className="text-xs text-emerald-600 font-medium mt-0.5">{r.phpPayout.toFixed(2)} PHP</p>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              {r.status === "processing" ? (
                                <>
                                  <button
                                    onClick={() => setProofModalId(r.txId)}
                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                    title="Upload PHP proof"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleConfirm(r.txId)}
                                    disabled={confirmingId === r.txId}
                                    className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                  >
                                    {confirmingId === r.txId ? "..." : "Confirm"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setExpandedId(expandedId === r.txId ? null : r.txId)}
                                  className="text-xs font-bold text-primary hover:underline"
                                >
                                  {expandedId === r.txId ? "Hide" : "View Proof"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Proof Images */}
          {expandedId && (() => {
            const rec = remittances.find(r => r.txId === expandedId);
            if (!rec) return null;
            return (
              <div className="bg-white p-8 rounded-3xl premium-shadow border border-primary/10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-gray-900">Transaction Proofs</h3>
                  <button onClick={() => setExpandedId(null)} className="text-xs font-bold text-gray-400 hover:text-gray-900">Close ✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {rec.senderProofRef ? (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sender Proof (VND)</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rec.senderProofRef} alt="Sender proof" className="rounded-2xl border border-gray-100 w-full" />
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl p-8 flex flex-col items-center gap-2 border border-dashed border-gray-200 text-gray-300">
                      <ImageIcon className="w-8 h-8" />
                      <p className="text-xs font-medium text-gray-400">No sender proof</p>
                    </div>
                  )}
                  {rec.agentProofRef ? (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Agent Proof (PHP)</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rec.agentProofRef} alt="Agent proof" className="rounded-2xl border border-gray-100 w-full" />
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl p-8 flex flex-col items-center gap-2 border border-dashed border-gray-200 text-gray-300">
                      <ImageIcon className="w-8 h-8" />
                      <p className="text-xs font-medium text-gray-400">No agent proof</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {proofModalId && (
        <ProofUploadModal
          txId={proofModalId}
          onClose={() => setProofModalId(null)}
          onSuccess={fetchAll}
        />
      )}
    </main>
  );
}
