"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RemittanceRecord } from "@/lib/types";
import {
  ArrowLeft, CheckCircle2, Clock, AlertCircle, ExternalLink,
  ShieldCheck, Globe2, FileText, Image as ImageIcon, Zap,
  ArrowRight, User, Activity, Banknote, Building2, QrCode,
  XCircle, Loader2, Wallet, Copy, Check,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// ── Status Config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; desc: string; icon: any }> = {
  pending_agent: { label: "Waiting for Agent",     color: "text-indigo-600 bg-indigo-50 border-indigo-100",  desc: "Your request has been sent. Waiting for the agent to accept and lock USDC.", icon: Activity },
  cancelled:     { label: "Cancelled",             color: "text-gray-500 bg-gray-50 border-gray-200",        desc: "You cancelled this request before the agent accepted.", icon: XCircle },
  funded:        { label: "Agent Accepted — Pay Now", color: "text-amber-600 bg-amber-50 border-amber-100",  desc: "Agent has locked the USDC. You have 5 minutes to complete the VND transfer.", icon: Clock },
  processing:    { label: "Payout in Progress",    color: "text-blue-600 bg-blue-50 border-blue-100",        desc: "Agent is transferring funds to the receiver.", icon: Zap },
  payout_submitted: { label: "Awaiting Receiver Confirm", color: "text-indigo-600 bg-indigo-50 border-indigo-100", desc: "Agent has submitted payout proof. Waiting for receiver to acknowledge.", icon: ShieldCheck },
  completed:     { label: "Transfer Completed",    color: "text-emerald-600 bg-emerald-50 border-emerald-100", desc: "Success! The funds have been delivered to the receiver.", icon: CheckCircle2 },
  expired:       { label: "Transaction Expired",   color: "text-red-600 bg-red-50 border-red-100",           desc: "Time limit exceeded. USDC has been unlocked for the agent.", icon: AlertCircle },
};

function fmt(ts: string | null) {
  if (!ts) return null;
  return new Date(ts).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function shortWallet(w: string | null) {
  if (!w) return "—";
  return w.slice(0, 6) + "..." + w.slice(-6);
}

function getSteps(status: string, currency: string = "PHP") {
  const isExpired = status === "expired";
  return [
    { label: "Requested", done: true },
    { label: status === "cancelled" ? "Cancelled" : "Agent Accept", active: status === "pending_agent", done: !["pending_agent","cancelled"].includes(status), cancelled: status === "cancelled" },
    { label: "Pay VND",   active: status === "funded", done: !["pending_agent","funded","cancelled","expired"].includes(status) },
    { label: `${currency} Payout`, active: ["processing","payout_submitted"].includes(status), done: status === "completed", expired: isExpired },
    { label: "Done",      done: status === "completed" },
  ];
}

interface AgentBank { bankName: string | null; accountNumber: string | null; accountHolder: string | null; qrImageUrl: string | null; }

// ── CopyButton ─────────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <button onClick={copy} className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-300 hover:text-gray-600">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Timeline Item ──────────────────────────────────────────────────────────────
function TimelineItem({ done, active, failed, label, time, children }: {
  done?: boolean; active?: boolean; failed?: boolean; expired?: boolean; label: string; time?: string | null; children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center gap-0">
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
          failed  ? "bg-red-500 border-red-500 text-white" :
          done    ? "bg-emerald-500 border-emerald-500 text-white" :
          active  ? "bg-primary border-primary text-white ring-4 ring-primary/20" :
                    "bg-white border-gray-100 text-gray-300"
        )}>
          {failed ? <XCircle className="w-4 h-4" /> : done ? <CheckCircle2 className="w-4 h-4" /> : active ? <div className="w-2 h-2 rounded-full bg-white animate-pulse" /> : <div className="w-2 h-2 rounded-full bg-gray-200" />}
        </div>
        {children && <div className="w-0.5 bg-gray-100 flex-1 mt-1 min-h-[20px]" />}
      </div>
      <div className={cn("pb-6 min-w-0 flex-1", !children && "pb-0")}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm font-bold", failed ? "text-red-600" : done ? "text-gray-900" : active ? "text-primary" : "text-gray-300")}>{label}</span>
          {time && <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full font-medium">{time}</span>}
          {active && !time && <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold animate-pulse">In progress</span>}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
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
      if (res.ok) { const d = await res.json(); setAgentBank({ bankName: d.agentBankName ?? null, accountNumber: d.agentAccountNumber ?? null, accountHolder: d.agentAccountHolder ?? null, qrImageUrl: d.agentQrImageUrl ?? null }); }
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
    const onVisible = () => { if (document.visibilityState === "visible") fetchRecord(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetchRecord, fetchAgentBank]);

  useEffect(() => {
    if ((record?.status === "funded" || record?.status === "processing") && timeRemaining > 0) {
      timerRef.current = setInterval(() => setTimeRemaining(p => Math.max(0, p - 1)), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [record?.status, timeRemaining]);

  useEffect(() => {
    if ((record?.status === "funded" || record?.status === "processing") && timeRemaining === 0) {
      fetch("/api/cron/check-timeouts", { method: "POST" }).catch(() => {});
    }
  }, [record?.status, timeRemaining]);

  const [cancelling, setCancelling] = useState(false);
  const handleCancel = async () => {
    if (!confirm("Cancel this remittance request?")) return;
    const prev = record;
    if (record) setRecord({ ...record, status: "cancelled" });
    setCancelling(true);
    try {
      const res = await fetch(`/api/remittance/${txId}/cancel`, { method: "POST" });
      if (!res.ok) { setRecord(prev); const d = await res.json(); alert(d.error ?? "Cancel failed"); }
      else fetchRecord();
    } catch { setRecord(prev); alert("Network error"); }
    finally { setCancelling(false); }
  };

  const handleUploadProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setUploadError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/remittance/${txId}/mark-paid`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofImageBase64: base64, proofImageMimeType: file.type || "image/jpeg" }),
      });
      if (res.ok) { setShowPayment(false); fetchRecord(); }
      else { const d = await res.json(); setUploadError(d.error ?? "Upload failed"); }
    } catch { setUploadError("Network error. Please try again."); }
    finally { setUploading(false); }
  };

  if (notFound) return (
    <main className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle className="w-20 h-20 text-gray-200 mb-6" />
      <h1 className="text-3xl font-bold text-gray-900">Transaction Not Found</h1>
      <button onClick={() => router.push("/send")} className="btn-primary mt-10 rounded-2xl px-8 h-12">Back to Dashboard</button>
    </main>
  );

  if (!record) return (
    <main className="min-h-screen bg-[#f9f9ff] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Loading Transaction</p>
      </div>
    </main>
  );

  const statusCfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.pending_agent;
  const StatusIcon = statusCfg.icon;
  const steps = getSteps(record.status, record.destinationCurrency || "PHP");
  const effectiveRate = record.vndAmount > 0 ? (record.phpPayout / record.vndAmount) : 0;

  return (
    <main className="min-h-screen bg-[#f9f9ff] py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.push("/send")} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className={cn("px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2", statusCfg.color)}>
            <StatusIcon className="w-3.5 h-3.5" />{statusCfg.label}
          </div>
        </div>

        {/* ── Step Progress (full width) ── */}
        <div className="bg-white rounded-[28px] premium-shadow border border-outline/5 p-6">
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute left-[7%] right-[7%] top-5 h-[2px] bg-gray-50 -z-0" />
            {steps.map((s: any, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 relative z-10">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-300",
                  s.cancelled || s.expired ? "bg-red-500 border-red-500 text-white" :
                  s.done   ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-100" :
                  s.active ? "bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-110" :
                             "bg-white border-gray-100 text-gray-300"
                )}>
                  {s.cancelled || s.expired ? <XCircle className="w-5 h-5" /> : s.done ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold text-xs">{idx + 1}</span>}
                </div>
                <span className={cn("text-[9px] font-bold uppercase tracking-widest text-center leading-tight max-w-[60px]",
                  (s.cancelled || s.expired) ? "text-red-500" : (s.done || s.active) ? "text-gray-700" : "text-gray-300"
                )}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2-column body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

          {/* ── LEFT col: Summary + Parties + Action ── */}
          <div className="lg:col-span-2 space-y-5 lg:sticky lg:top-8">

            {/* Transaction Summary */}
            <div className="bg-white rounded-[28px] premium-shadow border border-outline/5 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/5 rounded-xl flex items-center justify-center text-primary shrink-0">
                  <Banknote className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-900">Transaction Summary</h2>
                  <p className="text-[10px] text-gray-400 truncate">ID: <span className="font-mono">{record.txId.slice(0,20)}…</span></p>
                </div>
                <CopyBtn text={record.txId} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-2xl p-4 space-y-0.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">You Send</p>
                  <p className="text-xl font-bold text-gray-900 tabular-nums">{record.vndAmount.toLocaleString("vi-VN")}</p>
                  <p className="text-xs text-gray-400 font-medium">VND</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 space-y-0.5">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Receiver Gets</p>
                  <p className="text-xl font-bold text-emerald-700 tabular-nums">{record.phpPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-emerald-600 font-medium">{record.destinationCurrency || "PHP"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-indigo-50/60 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">USDC</p>
                  <p className="text-sm font-bold text-indigo-700">{record.usdcEquivalent.toFixed(4)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Rate</p>
                  <p className="text-sm font-bold text-gray-700">{effectiveRate.toFixed(4)}</p>
                  <p className="text-[9px] text-gray-400">{record.destinationCurrency}/VND</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Created</p>
                  <p className="text-[10px] font-bold text-gray-700 leading-tight">{fmt(record.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Parties */}
            <div className="bg-white rounded-[28px] premium-shadow border border-outline/5 p-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Parties</h3>
              {[
                { icon: User,      label: "Sender",   wallet: record.senderWallet,   name: record.senderName },
                { icon: User,      label: "Receiver", wallet: record.receiverWallet, name: record.receiverName },
                { icon: Building2, label: "Agent",    wallet: record.agentWallet,    name: null },
              ].map(({ icon: Icon, label, wallet, name }) => (
                <div key={label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-outline/10 shrink-0">
                    <Icon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
                    {name && <p className="text-sm font-bold text-gray-900">{name}</p>}
                    <p className="text-xs font-mono text-gray-400 truncate">{wallet ? shortWallet(wallet) : <span className="text-gray-300 italic">not assigned</span>}</p>
                  </div>
                  {wallet && <CopyBtn text={wallet} />}
                </div>
              ))}
            </div>

            {/* ── Action panel ── */}

            {/* pending_agent */}
            {record.status === "pending_agent" && (
              <div className="bg-white rounded-[28px] premium-shadow border border-outline/5 p-6 space-y-4">
                <div className="bg-indigo-600 rounded-2xl p-6 text-white flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <Activity className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="font-bold">Waiting for Agent</p>
                    <p className="text-xs text-white/70 mt-0.5">Agent needs to lock <b>{record.usdcEquivalent.toFixed(2)} USDC</b> before you pay.</p>
                  </div>
                </div>
                <button onClick={handleCancel} disabled={cancelling} className="w-full h-11 rounded-2xl border border-red-200 text-red-500 hover:bg-red-50 font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {cancelling ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</> : <><XCircle className="w-4 h-4" /> Cancel Request</>}
                </button>
              </div>
            )}

            {/* cancelled */}
            {record.status === "cancelled" && (
              <div className="bg-white rounded-[28px] border border-outline/5 p-6 flex flex-col items-center text-center gap-4">
                <XCircle className="w-10 h-10 text-gray-300" />
                <div>
                  <p className="font-bold text-gray-900">Request Cancelled</p>
                  <p className="text-sm text-gray-400 mt-1">No funds were locked.</p>
                </div>
                <button onClick={() => router.push("/send")} className="btn-primary h-11 rounded-2xl px-8 font-bold text-sm">New Remittance</button>
              </div>
            )}

            {/* funded — choose whether to pay */}
            {record.status === "funded" && !showPayment && (
              <div className="bg-white rounded-[28px] premium-shadow border border-outline/5 p-6 space-y-4">
                {timeRemaining === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-4">
                    <AlertCircle className="w-8 h-8 text-red-400 shrink-0" />
                    <div>
                      <p className="font-bold text-red-900">Payment Window Expired</p>
                      <p className="text-xs text-red-700/70 mt-1">USDC is being returned to the agent.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
                      <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-amber-900">Agent Accepted!</p>
                        <p className="text-xs text-amber-700/70 mt-0.5">USDC locked in escrow. Complete your VND transfer now.</p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-amber-100">
                        <Clock className={cn("w-4 h-4", timeRemaining < 60 ? "text-red-500 animate-pulse" : "text-amber-500")} />
                        <span className={cn("text-xl font-mono font-bold tabular-nums", timeRemaining < 60 ? "text-red-600" : "text-amber-600")}>
                          {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setShowPayment(true)} className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-amber-200 flex items-center justify-center gap-2 transition-all">
                      <Banknote className="w-4 h-4" /> Proceed to Payment <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* funded + showPayment */}
            {record.status === "funded" && showPayment && (
              <div className="bg-white rounded-[28px] premium-shadow border border-outline/5 p-6 space-y-5">
                {timeRemaining === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
                    <p className="font-bold text-red-900">Payment Window Expired</p>
                    <button onClick={() => router.push("/send")} className="px-6 h-10 bg-red-500 text-white rounded-xl font-bold text-sm">New Remittance</button>
                  </div>
                ) : (
                  <>
                    {/* Agent bank info */}
                    <div className="bg-gray-50 rounded-2xl p-5 space-y-4 border border-outline/5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transfer To</p>
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl">
                          <Clock className={cn("w-3.5 h-3.5", timeRemaining < 60 ? "text-red-500 animate-pulse" : "text-amber-500")} />
                          <span className={cn("text-base font-mono font-bold tabular-nums", timeRemaining < 60 ? "text-red-600" : "text-amber-600")}>
                            {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-6 items-start">
                        <div className="flex-1 space-y-3">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Building2 className="w-3 h-3" /> Bank</p>
                            <p className="text-lg font-bold text-gray-900">{agentBank?.bankName ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account Number</p>
                            <p className="text-xl font-mono font-bold text-gray-900 select-all">{agentBank?.accountNumber ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account Holder</p>
                            <p className="text-base font-bold text-gray-900">{agentBank?.accountHolder ?? "—"}</p>
                          </div>
                          <div className="pt-3 border-t border-outline/10">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transfer Exactly</p>
                            <p className="text-3xl font-bold text-primary tracking-tight">{record.vndAmount.toLocaleString("vi-VN")} <span className="text-base font-medium text-gray-300">VND</span></p>
                          </div>
                        </div>
                        {agentBank?.qrImageUrl && (
                          <div className="shrink-0">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><QrCode className="w-3 h-3" /> QR</p>
                            <img src={agentBank.qrImageUrl} alt="QR" className="w-32 h-32 object-contain rounded-xl border border-outline/10 bg-white p-1.5" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload proof */}
                    <form onSubmit={handleUploadProof} className="space-y-3">
                      <div className="border-2 border-dashed border-outline/20 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-primary/40 transition-all cursor-pointer relative group bg-gray-50/50 hover:bg-white">
                        <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ImageIcon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-gray-900 text-sm">{file ? file.name : "Upload Bank Transfer Receipt"}</p>
                          <p className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 10MB</p>
                        </div>
                      </div>
                      {uploadError && <p className="text-center text-xs text-red-500 font-bold">⚠️ {uploadError}</p>}
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setShowPayment(false)} className="flex-1 h-11 rounded-xl border border-outline/20 font-bold text-sm text-gray-500 hover:bg-gray-50 transition-all">Back</button>
                        <button type="submit" disabled={!file || uploading} className="flex-[2] btn-primary h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                          {uploading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</> : <>Confirm Transfer <ArrowRight className="w-4 h-4" /></>}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            )}

            {/* processing */}
            {record.status === "processing" && (
              <div className="bg-blue-600 rounded-[28px] p-6 text-white flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center relative shrink-0">
                  <div className="absolute inset-0 rounded-xl border-2 border-white/20 border-t-white animate-spin" />
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold">Processing Payout</p>
                  <p className="text-sm text-white/70 mt-0.5">Agent is transferring <b>{record.phpPayout.toFixed(2)} {record.destinationCurrency || "PHP"}</b> to the receiver.</p>
                </div>
              </div>
            )}

            {/* payout_submitted */}
            {record.status === "payout_submitted" && (
              <div className="bg-indigo-600 rounded-[28px] p-6 text-white flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold">Payout Submitted</p>
                  <p className="text-sm text-white/70 mt-0.5">Waiting for receiver to confirm receipt on-chain.</p>
                </div>
              </div>
            )}

            {/* completed */}
            {record.status === "completed" && (
              <div className="space-y-3">
                <div className="bg-emerald-500 rounded-[28px] p-6 text-white flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Transfer Completed</p>
                    <p className="text-sm text-emerald-50 mt-0.5">Funds delivered. Receiver confirmed on blockchain.</p>
                  </div>
                </div>
                {record.stellarTxHash && (
                  <a href={`https://stellar.expert/explorer/testnet/tx/${record.stellarTxHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between p-5 bg-white rounded-2xl border border-outline/10 hover:border-primary/30 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary"><Globe2 className="w-5 h-5" /></div>
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-primary transition-colors text-sm">Blockchain Receipt</p>
                        <p className="text-xs text-gray-400">View on Stellar Expert</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-primary transition-all" />
                  </a>
                )}
              </div>
            )}

            {/* expired */}
            {record.status === "expired" && (
              <div className="bg-red-500 rounded-[28px] p-6 text-white flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-bold">Transaction Expired</p>
                  <p className="text-sm text-red-100 mt-0.5">Payment window closed. USDC returned to agent.</p>
                </div>
                <button onClick={() => router.push("/send")} className="shrink-0 bg-white text-red-500 h-9 rounded-xl px-4 font-bold text-xs">New</button>
              </div>
            )}

          </div>{/* end left col */}

          {/* ── RIGHT col: Timeline ── */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-[28px] premium-shadow border border-outline/5 p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Timeline</h3>
              <div className="pl-1">

                <TimelineItem done label="Request Created" time={fmt(record.createdAt)} />

                <TimelineItem
                  done={!!record.fundedAt}
                  active={record.status === "pending_agent"}
                  failed={record.status === "cancelled"}
                  label={record.status === "cancelled" ? "Cancelled by Sender" : "Agent Accepted & Locked USDC"}
                  time={fmt(record.fundedAt)}
                />

                <TimelineItem
                  done={!!record.processingAt}
                  active={record.status === "funded"}
                  label="Sender Paid VND"
                  time={fmt(record.processingAt)}
                >
                  {record.senderProofRef && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <ImageIcon className="w-3 h-3" /> Payment Proof (Sender)
                      </p>
                      <a href={record.senderProofRef} target="_blank" rel="noopener noreferrer">
                        <img src={record.senderProofRef} alt="Sender payment proof" className="w-full max-w-xs rounded-xl border border-outline/10 object-cover hover:opacity-90 transition-opacity cursor-zoom-in" />
                      </a>
                    </div>
                  )}
                </TimelineItem>

                <TimelineItem
                  done={!!record.payoutSubmittedAt}
                  active={record.status === "processing"}
                  failed={record.status === "expired"}
                  label={record.status === "expired" ? "Expired — USDC Refunded" : `Agent Paid ${record.destinationCurrency || "PHP"} to Receiver`}
                  time={fmt(record.payoutSubmittedAt)}
                >
                  {record.agentProofRef && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <ImageIcon className="w-3 h-3" /> Payout Proof (Agent)
                      </p>
                      <a href={record.agentProofRef} target="_blank" rel="noopener noreferrer">
                        <img src={record.agentProofRef} alt="Agent payout proof" className="w-full max-w-xs rounded-xl border border-outline/10 object-cover hover:opacity-90 transition-opacity cursor-zoom-in" />
                      </a>
                    </div>
                  )}
                </TimelineItem>

                <TimelineItem
                  done={record.status === "completed"}
                  active={record.status === "payout_submitted"}
                  label="Receiver Confirmed on Blockchain"
                  time={fmt(record.completedAt)}
                >
                  {record.stellarTxHash && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${record.stellarTxHash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                    >
                      <Globe2 className="w-3.5 h-3.5" />
                      {record.stellarTxHash.slice(0,14)}… — View on Stellar Expert
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </TimelineItem>

              </div>
            </div>
          </div>{/* end right col */}

        </div>{/* end 2-col grid */}

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 py-2">
          <ShieldCheck className="w-4 h-4 text-primary/40" />
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em]">Soroban Smart Escrow · Stellar Testnet</span>
        </div>

      </div>
    </main>
  );
}
