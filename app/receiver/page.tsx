"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useWallet } from "@/components/wallet-provider";
import type { RemittanceRecord } from "@/lib/types";
import {
  LogOut,
  Clock,
  CheckCircle2,
  AlertCircle,
  Globe2,
  ExternalLink,
  User,
  Building2,
  CreditCard,
  Inbox,
} from "lucide-react";

const STATUS_CONFIG: Record<
  RemittanceRecord["status"],
  { label: string; color: string }
> = {
  funded: { label: "Pending VND", color: "text-amber-600 bg-amber-50 border-amber-100" },
  processing: { label: "Processing", color: "text-blue-600 bg-blue-50 border-blue-100" },
  completed: { label: "Completed", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  expired: { label: "Expired", color: "text-gray-500 bg-gray-50 border-gray-100" },
};

export default function ReceiverDashboard() {
  const { address, bankInfo, disconnect } = useWallet();
  const [remittances, setRemittances] = useState<RemittanceRecord[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/remittance");
      if (res.ok) {
        const d = await res.json();
        // Filter remittances where receiver account matches this user's bank account
        const all: RemittanceRecord[] = d.remittances ?? [];
        const mine = bankInfo
          ? all.filter((r) => r.receiverAccount === bankInfo.accountNumber)
          : all;
        setRemittances(mine);
      }
    } catch { /* ignore */ }
  }, [bankInfo]);

  useEffect(() => {
    fetchAll();
    pollingRef.current = setInterval(fetchAll, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchAll]);

  const pending = remittances.filter((r) => r.status === "processing");
  const completed = remittances.filter((r) => r.status === "completed");
  const totalReceived = completed.reduce((s, r) => s + r.phpPayout, 0);

  return (
    <main className="min-h-screen bg-[#f9f9ff]">
      {/* Header */}
      <header className="h-20 bg-white border-b border-outline/10 px-8 flex items-center justify-between sticky top-0 z-20 premium-shadow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">
            📥
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Receiver Dashboard</h1>
            <p className="text-xs text-gray-400 font-mono">
              {address?.slice(0, 8)}...{address?.slice(-6)}
            </p>
          </div>
        </div>
        <button
          onClick={disconnect}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Bank Info Card */}
        {bankInfo && (
          <div className="bg-white rounded-3xl premium-shadow border border-outline/5 p-6">
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Your Payout Account
            </h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank</p>
                <p className="font-semibold text-gray-900 mt-1">{bankInfo.bankName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Account
                </p>
                <p className="font-semibold text-gray-900 font-mono mt-1">{bankInfo.accountNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3" /> Holder
                </p>
                <p className="font-semibold text-gray-900 mt-1">{bankInfo.accountHolder}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl premium-shadow border border-outline/5">
            <p className="text-sm text-gray-500">Total Received</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">
              {totalReceived.toFixed(2)} <span className="text-lg font-medium text-gray-400">PHP</span>
            </p>
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
              {remittances.map((r) => {
                const cfg = STATUS_CONFIG[r.status];
                return (
                  <div key={r.txId} className="px-8 py-5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                          {r.status === "funded" && <Clock className="w-3 h-3" />}
                          {r.status === "processing" && <Clock className="w-3 h-3" />}
                          {r.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                          {r.status === "expired" && <AlertCircle className="w-3 h-3" />}
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-gray-400">{r.txId.slice(0, 16)}...</p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-emerald-600 text-lg">
                        {r.phpPayout.toFixed(2)} PHP
                      </p>
                      <p className="text-xs text-gray-400">
                        from {r.vndAmount.toLocaleString()} VND
                      </p>
                    </div>

                    {r.stellarTxHash && r.status === "completed" && (
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${r.stellarTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-300 hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
