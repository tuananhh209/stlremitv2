"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { RemittanceRecord, AgentBalanceResponse } from "@/lib/types";
import { useWallet } from "@/components/wallet-provider";
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  Search,
  Plus,
  Image as ImageIcon
} from "lucide-react";

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  funded: { label: "Pending VND", color: "text-amber-600 bg-amber-50 border-amber-100", icon: Clock },
  processing: { label: "Processing PHP", color: "text-blue-600 bg-blue-50 border-blue-100", icon: ArrowUpRight },
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

// ── Countdown ─────────────────────────────────────────────────────────────────

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calc = () =>
      setRemaining(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
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

// ── Proof Upload Modal ────────────────────────────────────────────────────────

function ProofUploadModal({
  txId,
  onClose,
  onSuccess,
}: {
  txId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
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
          <p className="text-sm text-gray-500 mt-1">Upload a screenshot of the GCash/Bank transfer.</p>
        </div>
        
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-outline/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors cursor-pointer relative">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-gray-900">{file ? file.name : "Click to select image"}</p>
            <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
          </div>

          {error && <p className="text-red-600 text-xs text-center font-medium">⚠️ {error}</p>}
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary py-2.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || loading}
              className="flex-1 btn-primary py-2.5 text-sm"
            >
              {loading ? "Uploading..." : "Upload Proof"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function AgentDashboard() {
  const { address, sign, isConnected } = useWallet();
  const [remittances, setRemittances] = useState<RemittanceRecord[]>([]);
  const [balance, setBalance] = useState<AgentBalanceResponse | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [proofModalId, setProofModalId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [rRes, bRes] = await Promise.all([
        fetch("/api/remittance"),
        fetch("/api/agent/balance"),
      ]);
      if (rRes.ok) {
        const d = await rRes.json();
        setRemittances(d.remittances ?? []);
      }
      if (bRes.ok) {
        const d = await bRes.json();
        setBalance(d);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAll();
    pollingRef.current = setInterval(fetchAll, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchAll]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !address) {
      alert("Please connect your wallet first");
      return;
    }
    setDepositLoading(true);
    try {
      // 1. Get unsigned XDR from API
      const res = await fetch("/api/agent/build-fund-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: address, usdcAmount: parseFloat(depositAmount) }),
      });
      const { xdr } = await res.json();
      
      // 2. Sign with wallet
      const signedXdr = await sign(xdr, "TESTNET");
      
      // 3. Submit signed XDR
      const submitRes = await fetch("/api/stellar/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr }),
      });
      
      if (submitRes.ok) {
        setDepositAmount("");
        fetchAll();
        alert("Deposit successful!");
      } else {
        alert("Transaction failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error during deposit");
    } finally {
      setDepositLoading(false);
    }
  }

  async function handleConfirm(txId: string) {
    if (!isConnected || !address) {
      alert("Please connect your wallet first");
      return;
    }
    setConfirmingId(txId);
    try {
      const res = await fetch("/api/agent/build-confirm-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: address, txId }),
      });
      const { xdr } = await res.json();
      const signedXdr = await sign(xdr, "TESTNET");
      
      const submitRes = await fetch("/api/stellar/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr }),
      });
      
      if (submitRes.ok) {
        fetchAll();
      } else {
        alert("Confirmation failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error during confirmation");
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f9f9ff] flex">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-white border-r border-outline/10 p-6 flex flex-col gap-8 hidden lg:flex">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 tracking-tight">STL Remit</span>
        </div>

        <nav className="flex flex-col gap-1">
          <button className="flex items-center gap-3 px-3 py-2 bg-primary/5 text-primary rounded-lg font-medium text-sm transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            Overview
          </button>
          <button className="flex items-center gap-3 px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors">
            <Clock className="w-4 h-4" />
            History
          </button>
          <button className="flex items-center gap-3 px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors">
            <Wallet className="w-4 h-4" />
            Pools
          </button>
        </nav>

        <div className="mt-auto p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Network</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-gray-700">Stellar Testnet</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white border-b border-outline/10 px-8 flex items-center justify-between sticky top-0 z-20">
          <h1 className="text-xl font-bold text-gray-900 lg:hidden">Dashboard</h1>
          <div className="hidden lg:flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 min-w-[320px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search transactions..." 
              className="bg-transparent border-none text-sm focus:ring-0 w-full text-gray-900"
            />
          </div>

          <div className="flex items-center gap-4">
            {isConnected ? (
              <div className="flex items-center gap-3 pl-4 border-l border-outline/10">
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase">Agent Wallet</p>
                  <p className="text-sm font-mono text-gray-900 font-medium">{address?.slice(0, 4)}...{address?.slice(-4)}</p>
                </div>
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                  {address?.[0]}
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-500 font-medium">Wallet Disconnected</p>
            )}
          </div>
        </header>

        <div className="p-8 space-y-8 overflow-y-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl premium-shadow border border-outline/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                  <Wallet className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Available</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Available Collateral</p>
                <p className="text-3xl font-bold text-gray-900">{balance?.availableUsdc.toFixed(2) ?? "0.00"} <span className="text-lg font-medium text-gray-400">USDC</span></p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl premium-shadow border border-outline/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Reserved</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Active Reserves</p>
                <p className="text-3xl font-bold text-gray-900">{balance?.reservedUsdc.toFixed(2) ?? "0.00"} <span className="text-lg font-medium text-gray-400">USDC</span></p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl premium-shadow border border-primary text-white bg-primary relative overflow-hidden group">
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
              <div className="relative z-10 space-y-4">
                <p className="text-sm font-medium text-white/80">Manage Liquidity</p>
                <form onSubmit={handleDeposit} className="space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Amount"
                      className="bg-white/20 border-white/20 text-white placeholder:text-white/50 rounded-xl text-sm w-full focus:ring-white/30"
                    />
                    <button 
                      disabled={depositLoading || !depositAmount}
                      className="bg-white text-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors shrink-0 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {depositLoading ? "..." : "Add"}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/60 font-medium">Add USDC to the smart contract pool.</p>
                </form>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-3xl premium-shadow border border-outline/5 overflow-hidden">
            <div className="px-8 py-6 border-b border-outline/10 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-900">Active Remittances</h2>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-white">
                    <th className="px-8 py-4">Transaction ID / Receiver</th>
                    <th className="px-8 py-4">Status / Timer</th>
                    <th className="px-8 py-4 text-right">Amounts</th>
                    <th className="px-8 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/5">
                  {remittances.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-3">
                          <Search className="w-10 h-10 text-gray-200" />
                          <p className="text-sm font-medium">No transactions found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    remittances.map((r) => (
                      <tr key={r.txId} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-gray-900">{r.receiverName}</p>
                            <p className="text-xs font-mono text-gray-400">{r.txId.slice(0, 12)}...</p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col gap-2">
                            <StatusBadge status={r.status} />
                            {r.status === "funded" && <Countdown expiresAt={r.expiresAt} />}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-gray-900">{r.vndAmount.toLocaleString()} VND</p>
                            <p className="text-xs font-medium text-emerald-600">{r.phpPayout.toFixed(2)} PHP</p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            {r.status === "processing" ? (
                              <>
                                <button
                                  onClick={() => setProofModalId(r.txId)}
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                  title="Upload Proof"
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
                                {expandedId === r.txId ? "Hide Proof" : "View Proof"}
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
          </div>

          {/* Proof Images Display */}
          {expandedId && remittances.find(r => r.txId === expandedId) && (
            <div className="bg-white p-8 rounded-3xl premium-shadow border border-primary/10 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900">Transaction Proofs</h3>
                <button onClick={() => setExpandedId(null)} className="text-xs font-bold text-gray-400 hover:text-gray-900">Close</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {remittances.find(r => r.txId === expandedId)?.senderProofRef ? (
                   <div className="space-y-3">
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sender Proof (VND Payment)</p>
                     <img src={remittances.find(r => r.txId === expandedId)?.senderProofRef} alt="Sender proof" className="rounded-2xl border border-outline/10 w-full" />
                   </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-8 flex flex-col items-center justify-center text-gray-300 gap-2 border border-dashed border-outline/10">
                    <ImageIcon className="w-8 h-8" />
                    <p className="text-xs font-medium">No sender proof provided</p>
                  </div>
                )}
                
                {remittances.find(r => r.txId === expandedId)?.agentProofRef ? (
                   <div className="space-y-3">
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Agent Proof (PHP Payout)</p>
                     <img src={remittances.find(r => r.txId === expandedId)?.agentProofRef} alt="Agent proof" className="rounded-2xl border border-outline/10 w-full" />
                   </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-8 flex flex-col items-center justify-center text-gray-300 gap-2 border border-dashed border-outline/10">
                    <ImageIcon className="w-8 h-8" />
                    <p className="text-xs font-medium">No agent proof provided</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
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

