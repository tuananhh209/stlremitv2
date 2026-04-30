"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RemittanceRecord } from "@/lib/types";
import {
  ArrowLeft, CheckCircle2, Clock, AlertCircle, ExternalLink,
  ShieldCheck, Globe2, FileText, Image as ImageIcon, Zap,
  ArrowRight, User, CreditCard, Activity, Banknote, Building2, QrCode,
  XCircle, Loader2,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// ── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; desc: string; icon: any }> = {
  pending_agent: {
    label: "Waiting for Agent",
    color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    desc: "Your request has been sent. Waiting for the agent to accept and lock USDC.",
    icon: Activity,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-gray-500 bg-gray-50 border-gray-200",
    desc: "You cancelled this request before the agent accepted.",
    icon: XCircle,
  },
  funded: {
    label: "Agent Accepted — Pay Now",
    color: "text-amber-600 bg-amber-50 border-amber-100",
    desc: "Agent has locked the USDC. You have 5 minutes to complete the VND transfer.",
    icon: Clock,
  },
  processing: {
    label: "PHP Payout in Progress",
    color: "text-blue-600 bg-blue-50 border-blue-100",
    desc: "Agent is transferring PHP to the receiver.",
    icon: Zap,
  },
  payout_submitted: {
    label: "Awaiting Receiver Confirm",
    color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    desc: "Agent has submitted payout proof. Waiting for receiver to acknowledge.",
    icon: ShieldCheck,
  },
  completed: {
    label: "Transfer Completed",
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    desc: "Success! The funds have been delivered to the receiver.",
    icon: CheckCircle2,
  },
  expired: {
    label: "Transaction Expired",
    color: "text-red-600 bg-red-50 border-red-100",
    desc: "Time limit exceeded. USDC has been unlocked for the agent.",
    icon: AlertCircle,
  },
};

function getSteps(status: string) {
  const isExpired = status === "expired";
  
  return [
    { label: "Requested", done: true },
    { 
      label: status === "cancelled" ? "Cancelled" : "Agent Accept", 
      active: status === "pending_agent", 
      done: !["pending_agent", "cancelled"].includes(status),
      cancelled: status === "cancelled"
    },
    { 
      label: "Pay VND", 
      active: status === "funded", 
      done: !["pending_agent", "funded", "cancelled", "expired"].includes(status),
    },
    { 
      label: "PHP Payout", 
      active: ["processing", "payout_submitted"].includes(status), 
      done: status === "completed",
      expired: isExpired // Show the failure at Phase 4 as requested
    },
    { label: "Done", done: status === "completed" },
  ];
}

interface AgentBank {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  qrImageUrl: string | null;
}

export default function TransactionStatusPage() {
  const router = useRouter();
  const { txId } = useParams<{ txId: string }>();
  const [record, setRecord] = useState<RemittanceRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [agentBank, setAgentBank] = useState<AgentBank | null>(null);

  const [showPayment, setShowPayment] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [timeRemaining, setTimeRemaining] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAgentBank = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/profile");
      if (res.ok) {
        const data = await res.json();
        setAgentBank({
          bankName: data.agentBankName ?? null,
          accountNumber: data.agentAccountNumber ?? null,
          accountHolder: data.agentAccountHolder ?? null,
          qrImageUrl: data.agentQrImageUrl ?? null,
        });
      }
    } catch { /* ignore */ }
  }, []);

  const fetchRecord = useCallback(async () => {
    try {
      const res = await fetch(`/api/remittance/${txId}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) return;
      const data: RemittanceRecord = await res.json();
      setRecord(data);
      if (data.status === "funded" || data.status === "processing") {
        const diff = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
        setTimeRemaining(diff);
      }
      if (data.status === "completed" || data.status === "expired") {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    } catch { /* ignore */ }
  }, [txId]);

  useEffect(() => {
    fetchRecord();
    fetchAgentBank();
    pollingRef.current = setInterval(fetchRecord, 2000);

    // Re-fetch immediately when tab becomes visible
    const onVisible = () => { if (document.visibilityState === "visible") fetchRecord(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchRecord, fetchAgentBank]);

  useEffect(() => {
    if ((record?.status === "funded" || record?.status === "processing") && timeRemaining > 0) {
      timerRef.current = setInterval(() => setTimeRemaining(p => Math.max(0, p - 1)), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [record?.status, timeRemaining]);

  // When timer hits 0 on funded status → trigger refund immediately
  useEffect(() => {
    if ((record?.status === "funded" || record?.status === "processing") && timeRemaining === 0) {
      fetch("/api/cron/check-timeouts", { method: "POST" }).catch(() => {});
    }
  }, [record?.status, timeRemaining]);

  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm("Cancel this remittance request?")) return;
    
    // Optimistic UI update for immediate feedback
    const prevRecord = record;
    if (record) {
      setRecord({ ...record, status: "cancelled" });
    }
    
    setCancelling(true);
    try {
      const res = await fetch(`/api/remittance/${txId}/cancel`, { method: "POST" });
      if (!res.ok) {
        // Rollback on error
        setRecord(prevRecord);
        const d = await res.json(); 
        alert(d.error ?? "Cancel failed"); 
      } else {
        fetchRecord();
      }
    } catch { 
      setRecord(prevRecord);
      alert("Network error"); 
    }
    finally { setCancelling(false); }
  };

  const handleUploadProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/remittance/${txId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofImageBase64: base64, proofImageMimeType: file.type || "image/jpeg" }),
      });
      if (res.ok) { setShowPayment(false); fetchRecord(); }
      else { const d = await res.json(); setUploadError(d.error ?? "Upload failed"); }
    } catch { setUploadError("Network error. Please try again."); }
    finally { setUploading(false); }
  };

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-20 h-20 text-gray-200 mb-6" />
        <h1 className="text-3xl font-bold text-gray-900">Transaction Not Found</h1>
        <p className="text-gray-500 mt-2 max-w-sm">The transaction ID is invalid or has been deleted.</p>
        <button onClick={() => router.push("/send")} className="btn-primary mt-10 rounded-2xl px-8 h-12">Back to Dashboard</button>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Loading Transaction</p>
        </div>
      </main>
    );
  }

  const statusCfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.pending_agent;
  const StatusIcon = statusCfg.icon;
  const steps = getSteps(record.status);

  return (
    <main className="min-h-screen bg-[#f9f9ff] flex flex-col items-center py-16 px-6">
      <div className="max-w-3xl w-full space-y-8">

        {/* Step Progress */}
        <div className="bg-white p-10 rounded-[40px] premium-shadow border border-outline/5 space-y-10">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push("/send")} className="p-3 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-outline/10 group">
              <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-gray-900" />
            </button>
            <div className={cn("px-5 py-2 rounded-full text-xs font-bold border flex items-center gap-2.5 shadow-sm", statusCfg.color)}>
              <StatusIcon className="w-4 h-4" />{statusCfg.label}
            </div>
          </div>
          <div className="flex items-center justify-between relative px-4">
            <div className="absolute left-[8%] right-[8%] top-6 h-[2px] bg-gray-50 -z-0" />
            {steps.map((s: any, idx) => (
              <div key={idx} className="flex flex-col items-center gap-3 relative z-10">
                <div className={cn(
                  "w-12 h-12 rounded-[18px] flex items-center justify-center border-2 transition-all duration-500",
                  s.cancelled || s.expired ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-100" :
                  s.done ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100" :
                  s.active ? "bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-110" :
                  "bg-white border-gray-100 text-gray-300"
                )}>
                  {s.cancelled || s.expired ? <XCircle className="w-6 h-6" /> : s.done ? <CheckCircle2 className="w-6 h-6" /> : <span className="font-bold text-sm">{idx + 1}</span>}
                </div>
                <span className={cn("text-[10px] font-bold uppercase tracking-widest", (s.cancelled || s.expired) ? "text-red-500" : (s.done || s.active) ? "text-gray-900" : "text-gray-200")}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[48px] premium-shadow border border-outline/5 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-2.5 bg-primary" />
          <div className="p-10 lg:p-14 space-y-10">

            {/* Amount */}
            <div className="text-center space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Amount to Send</p>
              <h2 className="text-5xl font-bold text-gray-900 tracking-tighter">
                {record.vndAmount.toLocaleString()} <span className="text-2xl font-medium text-gray-300">VND</span>
              </h2>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-2">
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><User className="w-3 h-3" /> Beneficiary</p>
                  <p className="text-xl font-bold text-gray-900">{record.receiverName}</p>
                  <div className="bg-gray-50 px-4 py-2 rounded-xl inline-flex items-center gap-2 border border-outline/5">
                    <CreditCard className="w-3 h-3 text-gray-400" />
                    <p className="text-sm font-mono text-gray-500">{record.receiverAccount}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><FileText className="w-3 h-3" /> Tracking ID</p>
                  <p className="text-xs font-mono text-gray-400 break-all bg-gray-50 p-3 rounded-xl border border-outline/5">{record.txId}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-emerald-50/50 p-6 rounded-[28px] border border-emerald-100/50 space-y-1">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Recipient Gets</p>
                  <p className="text-3xl font-bold text-emerald-700 tracking-tight">{record.phpPayout.toFixed(2)} PHP</p>
                </div>
                <div className="bg-indigo-50/50 p-6 rounded-[28px] border border-indigo-100/50 space-y-1">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">USDC Locked</p>
                  <p className="text-2xl font-bold text-indigo-700 tracking-tight">{record.usdcEquivalent.toFixed(4)} USDC</p>
                </div>
              </div>
            </div>

            {/* 1. pending_agent */}
            {record.status === "pending_agent" && (
              <div className="pt-8 border-t border-dashed border-outline/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-indigo-600 p-12 rounded-[40px] text-white flex flex-col items-center text-center gap-6 relative overflow-hidden shadow-2xl shadow-indigo-100">
                  <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                  <div className="w-20 h-20 bg-white/20 rounded-[24px] flex items-center justify-center backdrop-blur-md border border-white/20">
                    <Activity className="w-10 h-10 text-white animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-bold">Waiting for Agent</h4>
                    <p className="text-sm text-white/70 max-w-sm">Your request has been sent. Once the agent accepts and locks <b>{record.usdcEquivalent.toFixed(2)} USDC</b>, you'll be notified to pay.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 px-5 py-2.5 rounded-2xl border border-white/10 text-xs font-bold">
                    <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
                    Polling for agent response...
                  </div>
                </div>
                {/* Cancel button */}
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="mt-4 w-full h-12 rounded-2xl border border-red-200 text-red-500 hover:bg-red-50 font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {cancelling ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling...</> : <><XCircle className="w-4 h-4" /> Cancel Request</>}
                </button>
              </div>
            )}

            {/* 1b. cancelled */}
            {record.status === "cancelled" && (
              <div className="pt-8 border-t border-dashed border-outline/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gray-50 p-12 rounded-[40px] border border-outline/5 flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 bg-gray-100 rounded-[20px] flex items-center justify-center text-gray-400">
                    <XCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-gray-900">Request Cancelled</h4>
                    <p className="text-sm text-gray-400 max-w-sm">You cancelled this request before the agent accepted. No funds were locked.</p>
                  </div>
                  <button onClick={() => router.push("/send")} className="btn-primary h-12 rounded-2xl px-8 font-bold">New Remittance</button>
                </div>
              </div>
            )}

            {/* 2. funded: Pay button */}
            {record.status === "funded" && !showPayment && (
              <div className="pt-8 border-t border-dashed border-outline/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {timeRemaining === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-[40px] p-10 flex flex-col items-center text-center gap-4">
                    <AlertCircle className="w-10 h-10 text-red-400" />
                    <div>
                      <h4 className="text-lg font-bold text-red-900">Payment Window Expired</h4>
                      <p className="text-sm text-red-700/70 mt-1">The 5-minute window has passed. USDC is being returned to the agent.</p>
                    </div>
                    <button onClick={() => router.push("/send")} className="px-8 h-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm transition-all">
                      New Remittance
                    </button>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-[40px] p-10 space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-amber-900">Agent Accepted!</h4>
                        <p className="text-sm text-amber-700/70">USDC locked in escrow. Complete your VND transfer now.</p>
                      </div>
                    </div>
                    {/* Countdown preview */}
                    <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-amber-100 w-fit">
                      <Clock className={cn("w-5 h-5", timeRemaining < 60 ? "text-red-500 animate-pulse" : "text-amber-500")} />
                      <span className={cn("text-2xl font-mono font-bold", timeRemaining < 60 ? "text-red-600" : "text-amber-600")}>
                        {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                      </span>
                      <span className="text-xs text-amber-400 font-bold uppercase tracking-widest">remaining</span>
                    </div>
                    <button
                      onClick={() => setShowPayment(true)}
                      className="w-full h-16 bg-amber-500 hover:bg-amber-600 text-white rounded-[24px] font-bold text-sm shadow-xl shadow-amber-200 flex items-center justify-center gap-3 transition-all active:scale-95"
                    >
                      <Banknote className="w-5 h-5" /> Proceed to Payment <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. funded + showPayment */}
            {record.status === "funded" && showPayment && (
              <div className="pt-8 border-t border-dashed border-outline/10 animate-in zoom-in-95 duration-500 space-y-8">

                {/* ── EXPIRED LOCALLY (timer = 0, DB not yet updated) ── */}
                {timeRemaining === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-[40px] p-12 flex flex-col items-center text-center gap-6">
                    <div className="w-16 h-16 bg-red-100 rounded-[20px] flex items-center justify-center text-red-500">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xl font-bold text-red-900">Payment Window Expired</h4>
                      <p className="text-sm text-red-700/70 max-w-sm">
                        The 5-minute payment window has passed. The USDC is being returned to the agent. Please create a new remittance request.
                      </p>
                    </div>
                    <button
                      onClick={() => router.push("/send")}
                      className="px-8 h-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm transition-all"
                    >
                      New Remittance
                    </button>
                  </div>
                ) : (
                  <>
                <div className="bg-gray-50 rounded-[40px] p-10 border border-outline/5 shadow-inner space-y-8">
                  <div className="flex items-center justify-between border-b border-outline/10 pb-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transfer To</p>
                      <p className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        {agentBank?.bankName ?? "—"}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-outline/5">
                      <CreditCard className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-8 items-start">
                    <div className="flex-1 space-y-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account Number</p>
                        <p className="text-2xl font-mono font-bold text-gray-900 select-all">{agentBank?.accountNumber ?? "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account Holder</p>
                        <p className="text-xl font-bold text-gray-900">{agentBank?.accountHolder ?? "—"}</p>
                      </div>
                      <div className="pt-4 border-t border-outline/5 space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transfer Exactly</p>
                        <p className="text-4xl font-bold text-primary tracking-tighter">
                          {record.vndAmount.toLocaleString()} <span className="text-xl font-medium text-gray-300">VND</span>
                        </p>
                      </div>
                    </div>
                    {agentBank?.qrImageUrl && (
                      <div className="flex flex-col items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <QrCode className="w-3.5 h-3.5" /> Scan QR
                        </div>
                        <img src={agentBank.qrImageUrl} alt="Agent Bank QR" className="w-40 h-40 object-contain rounded-2xl border border-outline/10 bg-white p-2 shadow-sm" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 bg-amber-50 px-8 py-5 rounded-3xl border border-amber-100">
                  <Clock className={cn("w-6 h-6", timeRemaining < 60 ? "text-red-500 animate-pulse" : "text-amber-500 animate-pulse")} />
                  <span className={cn("text-4xl font-mono font-bold tracking-tight", timeRemaining < 60 ? "text-red-600" : "text-amber-600")}>
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">remaining</span>
                </div>

                <form onSubmit={handleUploadProof} className="space-y-4">
                  <div className="border-2 border-dashed border-outline/20 rounded-[32px] p-10 flex flex-col items-center justify-center gap-4 hover:border-primary/50 transition-all cursor-pointer relative group bg-gray-50/50 hover:bg-white">
                    <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <div className="w-16 h-16 bg-primary/5 rounded-[20px] flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                      <ImageIcon className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{file ? file.name : "Upload Bank Transfer Receipt"}</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</p>
                    </div>
                  </div>
                  {uploadError && <p className="text-center text-xs text-red-500 font-bold">⚠️ {uploadError}</p>}
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setShowPayment(false)} className="flex-1 h-14 rounded-[20px] border border-outline/20 font-bold text-sm text-gray-500 hover:bg-gray-50 transition-all">Back</button>
                    <button type="submit" disabled={!file || uploading} className="flex-[2] btn-primary h-14 rounded-[20px] font-bold text-sm shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50">
                      {uploading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</> : <>Confirm Transfer <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </form>
                  </>
                )}
              </div>
            )}

            {/* 4. processing */}
            {record.status === "processing" && (
              <div className="pt-8 border-t border-dashed border-outline/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-blue-600 p-12 rounded-[48px] text-white flex flex-col items-center text-center gap-8 shadow-2xl shadow-blue-100 relative overflow-hidden">
                  <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-white/10 rounded-full blur-[100px]" />
                  <div className="w-24 h-24 bg-white/20 rounded-[32px] flex items-center justify-center relative backdrop-blur-md border border-white/20">
                    <div className="absolute inset-0 rounded-[32px] border-4 border-white/10 border-t-white animate-spin" />
                    <Zap className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-3xl font-bold tracking-tight">Processing PHP Payout</h4>
                    <p className="text-white/70 max-w-sm text-lg">Agent has received your VND and is transferring <b>{record.phpPayout.toFixed(2)} PHP</b> to the recipient.</p>
                  </div>
                  
                  {/* Phase 4 Timer */}
                  <div className="flex items-center gap-4 bg-white/10 px-8 py-4 rounded-3xl border border-white/20 backdrop-blur-md">
                    <Clock className={cn("w-6 h-6", timeRemaining < 60 ? "text-red-300 animate-pulse" : "text-blue-200 animate-pulse")} />
                    <span className={cn("text-4xl font-mono font-bold tracking-tight", timeRemaining < 60 ? "text-red-200" : "text-white")}>
                      {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                    </span>
                    <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Time Left for Agent</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4.5. payout_submitted */}
            {record.status === "payout_submitted" && (
              <div className="pt-8 border-t border-dashed border-outline/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-indigo-600 p-12 rounded-[48px] text-white flex flex-col items-center text-center gap-8 shadow-2xl shadow-indigo-100 relative overflow-hidden">
                  <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-white/10 rounded-full blur-[100px]" />
                  <div className="w-24 h-24 bg-white/20 rounded-[32px] flex items-center justify-center relative backdrop-blur-md border border-white/20">
                    <ShieldCheck className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-3xl font-bold tracking-tight">Payout Submitted</h4>
                    <p className="text-white/70 max-w-sm text-lg">Agent has submitted proof of transfer. Waiting for the receiver to confirm receipt to finalize the transaction.</p>
                  </div>
                  
                  <div className="w-full max-w-xs h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-white/40 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
                  </div>
                </div>
              </div>
            )}

            {/* 5. completed */}
            {record.status === "completed" && (
              <div className="pt-8 border-t border-dashed border-outline/10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-emerald-500 p-16 rounded-[48px] text-white flex flex-col items-center text-center gap-8 shadow-2xl shadow-emerald-100">
                  <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center shadow-2xl">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-4xl font-bold tracking-tight">Transfer Completed</h4>
                    <p className="text-emerald-50 max-w-sm text-lg">Funds have been delivered to the receiver.</p>
                  </div>
                </div>
                {record.stellarTxHash && (
                  <a href={`https://stellar.expert/explorer/testnet/tx/${record.stellarTxHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-8 bg-white rounded-[32px] border border-outline/10 hover:border-primary/30 transition-all shadow-sm group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary"><Globe2 className="w-6 h-6" /></div>
                      <div className="text-left">
                        <p className="font-bold text-gray-900 group-hover:text-primary transition-colors">Blockchain Receipt</p>
                        <p className="text-xs text-gray-400">View on Stellar Expert</p>
                      </div>
                    </div>
                    <ExternalLink className="w-5 h-5 text-gray-300 group-hover:text-primary transition-all" />
                  </a>
                )}
              </div>
            )}

            {/* 6. expired */}
            {record.status === "expired" && (
              <div className="pt-8 border-t border-dashed border-outline/10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-red-500 p-16 rounded-[48px] text-white flex flex-col items-center text-center gap-8 shadow-2xl shadow-red-100">
                  <div className="w-24 h-24 bg-white/20 rounded-[32px] flex items-center justify-center backdrop-blur-md border border-white/20">
                    <Clock className="w-12 h-12 text-white" />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-4xl font-bold tracking-tight">Transaction Expired</h4>
                    <p className="text-red-50 max-w-sm text-lg">The payment window has closed. Any funds sent will be refunded to your source account.</p>
                  </div>
                  <button onClick={() => router.push("/send")} className="bg-white text-red-500 h-16 rounded-[24px] px-12 font-bold shadow-xl hover:bg-red-50 transition-all">New Remittance</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50/50 px-14 py-8 flex items-center justify-between border-t border-outline/5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Soroban Smart Escrow</span>
            </div>
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em]">Stellar Testnet</p>
          </div>
        </div>
      </div>
    </main>
  );
}
