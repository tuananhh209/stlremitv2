"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RemittanceRecord } from "@/lib/types";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Globe2,
  FileText,
  Image as ImageIcon,
  Zap,
  ArrowRight,
  User,
} from "lucide-react";

// ── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  RemittanceRecord["status"],
  { label: string; color: string }
> = {
  funded: {
    label: "Pending VND",
    color: "text-amber-600 bg-amber-50 border-amber-100",
  },
  processing: {
    label: "Processing PHP",
    color: "text-blue-600 bg-blue-50 border-blue-100",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  expired: {
    label: "Expired",
    color: "text-gray-500 bg-gray-50 border-gray-100",
  },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TransactionStatusPage() {
  const router = useRouter();
  const { txId } = useParams<{ txId: string }>();
  const [record, setRecord] = useState<RemittanceRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRecord = useCallback(async () => {
    try {
      const res = await fetch(`/api/remittance/${txId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      const data: RemittanceRecord = await res.json();
      setRecord(data);
      if (data.status === "completed" || data.status === "expired") {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    } catch {
      /* ignore */
    }
  }, [txId]);

  useEffect(() => {
    fetchRecord();
    pollingRef.current = setInterval(fetchRecord, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchRecord]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/remittance/${txId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofImageBase64: base64,
          proofImageMimeType: file.type || "image/jpeg",
        }),
      });
      if (res.ok) fetchRecord();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-16 h-16 text-gray-200 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">
          Transaction Not Found
        </h1>
        <p className="text-gray-500 mt-2">
          The requested transaction could not be located.
        </p>
        <button
          onClick={() => router.push("/send")}
          className="btn-primary mt-8"
        >
          Create New Transaction
        </button>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
            Loading Transaction
          </p>
        </div>
      </main>
    );
  }

  const steps = [
    { label: "Initiated", done: true },
    {
      label: "VND Payment",
      active: record.status === "funded",
      done: record.status !== "funded",
    },
    {
      label: "PHP Payout",
      active: record.status === "processing",
      done: record.status === "completed",
    },
    { label: "Completed", done: record.status === "completed" },
  ];

  const statusCfg = STATUS_CONFIG[record.status];

  return (
    <main className="min-h-screen bg-[#f9f9ff] flex flex-col items-center py-12 px-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Progress Header */}
        <div className="bg-white p-8 rounded-[32px] premium-shadow border border-outline/5 space-y-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div
              className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 ${statusCfg.color}`}
            >
              {record.status === "funded" && <Clock className="w-3 h-3" />}
              {record.status === "completed" && (
                <CheckCircle2 className="w-3 h-3" />
              )}
              {record.status === "expired" && (
                <AlertCircle className="w-3 h-3" />
              )}
              {statusCfg.label}
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute left-[10%] right-[10%] top-5 h-[2px] bg-gray-100 -z-0" />
            {steps.map((s, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center gap-3 relative z-10"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    s.done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : s.active
                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                      : "bg-white border-gray-100 text-gray-300"
                  }`}
                >
                  {s.done ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    s.done || s.active ? "text-gray-900" : "text-gray-300"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Receipt Card */}
        <div className="bg-white rounded-[32px] premium-shadow border border-outline/5 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-2 bg-primary" />

          <div className="p-10 space-y-10">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                Transaction Summary
              </p>
              <h2 className="text-4xl font-bold text-gray-900">
                {record.vndAmount.toLocaleString()}{" "}
                <span className="text-xl font-medium text-gray-400">VND</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Receiver
                  </p>
                  <p className="font-bold text-gray-900">
                    {record.receiverName}
                  </p>
                  <p className="text-sm text-gray-500 font-mono">
                    {record.receiverAccount}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Transaction ID
                  </p>
                  <p className="text-xs font-mono text-gray-500 break-all">
                    {record.txId}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50 space-y-1">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                    They Receive
                  </p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {record.phpPayout.toFixed(2)} PHP
                  </p>
                </div>
                <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 space-y-1">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                    Locked in Escrow
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {record.usdcEquivalent.toFixed(4)} USDC
                  </p>
                </div>
              </div>
            </div>

            {/* Funded: upload proof */}
            {record.status === "funded" && (
              <div className="pt-6 border-t border-dashed border-outline/20 space-y-6">
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">
                      Waiting for VND Transfer
                    </h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Please transfer the VND amount to the agent and upload
                      the receipt here.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="border-2 border-dashed border-outline/20 rounded-3xl p-10 flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors cursor-pointer relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-900">
                        {file ? file.name : "Click to upload VND receipt"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        PNG or JPG up to 10MB
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={!file || uploading}
                    className="w-full btn-primary h-14 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {uploading ? "Uploading..." : "Confirm Payment"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Processing */}
            {record.status === "processing" && (
              <div className="pt-6 border-t border-dashed border-outline/20">
                <div className="bg-blue-50 p-10 rounded-3xl border border-blue-100 flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                    <Zap className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-blue-900">
                      Processing PHP Payout
                    </h4>
                    <p className="text-sm text-blue-700">
                      The agent is now transferring PHP to your receiver.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Completed */}
            {record.status === "completed" && (
              <div className="pt-6 border-t border-dashed border-outline/20 space-y-6">
                <div className="bg-emerald-50 p-10 rounded-3xl border border-emerald-100 flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-emerald-900">
                      Transfer Completed!
                    </h4>
                    <p className="text-sm text-emerald-700">
                      The funds have been successfully delivered to the
                      receiver.
                    </p>
                  </div>
                </div>

                {record.stellarTxHash && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${record.stellarTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-outline/5 hover:border-primary/20 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Globe2 className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          View on Stellar Blockchain
                        </p>
                        <p className="text-xs text-gray-500">
                          Immutable proof of transaction
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                  </a>
                )}
              </div>
            )}

            {/* Expired */}
            {record.status === "expired" && (
              <div className="pt-6 border-t border-dashed border-outline/20">
                <div className="bg-gray-50 p-10 rounded-3xl border border-gray-100 flex flex-col items-center text-center gap-4">
                  <AlertCircle className="w-12 h-12 text-gray-300" />
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-gray-700">
                      Transaction Expired
                    </h4>
                    <p className="text-sm text-gray-500">
                      USDC has been refunded back to the agent.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/send")}
                    className="btn-primary mt-2"
                  >
                    Create New Transaction
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50/50 px-10 py-6 flex items-center justify-between border-t border-outline/10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Escrow Protected
              </span>
            </div>
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              Stellar Network
            </p>
          </div>
        </div>

        {/* Sender Proof */}
        {record.senderProofRef && (
          <div className="bg-white p-8 rounded-[32px] premium-shadow border border-outline/5 space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gray-400" />
              Payment Receipt
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={record.senderProofRef}
              alt="Sender proof"
              className="rounded-2xl border border-outline/10 w-full shadow-sm"
            />
          </div>
        )}
      </div>
    </main>
  );
}
