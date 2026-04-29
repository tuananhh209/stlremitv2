"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { RemittanceRecord, AgentBalanceResponse } from "@/lib/types";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  funded: { label: "Chờ TT", color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Đang xử lý", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Hoàn thành", color: "bg-green-100 text-green-800" },
  expired: { label: "Hết hạn", color: "bg-gray-100 text-gray-500" },
} as const;

function StatusBadge({ status }: { status: RemittanceRecord["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
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
    <span className={`font-mono text-xs ${remaining < 60 && remaining > 0 ? "text-red-600 font-bold" : "text-gray-600"}`}>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ── Proof upload modal ────────────────────────────────────────────────────────

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
        setError(d.error ?? "Upload thất bại");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("Lỗi khi upload");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="font-bold text-gray-900 mb-4">Upload ảnh chứng minh PHP</h3>
        <form onSubmit={handleUpload} className="space-y-3">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700"
          />
          {error && <p className="text-red-600 text-sm">⚠️ {error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!file || loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-semibold"
            >
              {loading ? "Đang gửi..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function AgentDashboard() {
  const [remittances, setRemittances] = useState<RemittanceRecord[]>([]);
  const [balance, setBalance] = useState<AgentBalanceResponse | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
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
    pollingRef.current = setInterval(fetchAll, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchAll]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setDepositError(null);
    setDepositSuccess(null);
    setDepositLoading(true);
    try {
      const res = await fetch("/api/agent/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usdcAmount: parseFloat(depositAmount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDepositError(data.error ?? "Deposit thất bại");
        return;
      }
      setDepositSuccess(`Đã deposit thành công! Balance mới: ${data.newBalance.toFixed(4)} USDC`);
      setDepositAmount("");
      fetchAll();
    } catch {
      setDepositError("Lỗi kết nối server");
    } finally {
      setDepositLoading(false);
    }
  }

  async function handleConfirm(txId: string) {
    setConfirmingId(txId);
    try {
      const res = await fetch(`/api/remittance/${txId}/confirm`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        alert(`Lỗi: ${d.error}`);
        return;
      }
      fetchAll();
    } catch {
      alert("Lỗi kết nối server");
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏦</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
            <p className="text-sm text-gray-500">Stellar Testnet · Soroban Escrow</p>
          </div>
        </div>

        {/* Balance + Deposit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Balance card */}
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
              Collateral Pool
            </h2>
            {balance ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Tổng collateral</span>
                  <span className="font-bold text-gray-900">{balance.totalCollateral.toFixed(4)} USDC</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Đang reserve</span>
                  <span className="font-semibold text-orange-600">{balance.reservedUsdc.toFixed(4)} USDC</span>
                </div>
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="text-gray-700 text-sm font-medium">Khả dụng</span>
                  <span className="font-bold text-emerald-600 text-lg">{balance.availableUsdc.toFixed(4)} USDC</span>
                </div>
              </div>
            ) : (
              <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />
            )}
          </div>

          {/* Deposit form */}
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
              Deposit Collateral
            </h2>
            <form onSubmit={handleDeposit} className="space-y-3">
              <div className="relative">
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Số USDC cần deposit"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-16 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 text-sm"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">USDC</span>
              </div>
              {depositError && <p className="text-red-600 text-xs">⚠️ {depositError}</p>}
              {depositSuccess && <p className="text-emerald-600 text-xs">✅ {depositSuccess}</p>}
              <button
                type="submit"
                disabled={depositLoading || !depositAmount}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {depositLoading ? "Đang xử lý..." : "Deposit vào Contract"}
              </button>
            </form>
          </div>
        </div>

        {/* Transactions table */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Tất cả giao dịch</h2>
            <span className="text-sm text-gray-400">{remittances.length} giao dịch</span>
          </div>

          {remittances.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">📭</p>
              <p>Chưa có giao dịch nào</p>
            </div>
          ) : (
            <div className="divide-y">
              {remittances.map((r) => (
                <div key={r.txId} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={r.status} />
                        {r.status === "funded" && (
                          <Countdown expiresAt={r.expiresAt} />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-mono truncate">{r.txId}</p>
                      <p className="text-sm text-gray-700 mt-1">
                        {r.receiverName} · <span className="font-mono text-xs">{r.receiverAccount}</span>
                      </p>
                    </div>

                    {/* Amounts */}
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-gray-900 text-sm">{r.vndAmount.toLocaleString()} VND</p>
                      <p className="text-xs text-indigo-600">{r.usdcEquivalent.toFixed(4)} USDC</p>
                      <p className="text-xs text-emerald-600">{r.phpPayout.toFixed(2)} PHP</p>
                    </div>
                  </div>

                  {/* Actions for processing */}
                  {r.status === "processing" && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setProofModalId(r.txId)}
                        className="flex-1 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 py-2 rounded-xl text-xs font-medium transition-colors"
                      >
                        📷 Upload Proof PHP
                      </button>
                      <button
                        onClick={() => handleConfirm(r.txId)}
                        disabled={confirmingId === r.txId}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white py-2 rounded-xl text-xs font-semibold transition-colors"
                      >
                        {confirmingId === r.txId ? "Đang xác nhận..." : "✅ Confirm Payout"}
                      </button>
                    </div>
                  )}

                  {/* Expand proof images */}
                  {(r.senderProofRef || r.agentProofRef) && (
                    <button
                      onClick={() => setExpandedId(expandedId === r.txId ? null : r.txId)}
                      className="mt-2 text-xs text-indigo-500 hover:underline"
                    >
                      {expandedId === r.txId ? "Ẩn ảnh ▲" : "Xem ảnh ▼"}
                    </button>
                  )}

                  {expandedId === r.txId && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {r.senderProofRef && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Ảnh Sender (VND)</p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.senderProofRef} alt="Sender proof" className="rounded-xl max-h-32 object-contain w-full bg-gray-50" />
                        </div>
                      )}
                      {r.agentProofRef && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Ảnh Agent (PHP)</p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.agentProofRef} alt="Agent proof" className="rounded-xl max-h-32 object-contain w-full bg-gray-50" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Proof upload modal */}
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
