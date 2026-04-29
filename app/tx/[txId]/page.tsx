"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import type { RemittanceRecord } from "@/lib/types";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  funded: { label: "Chờ thanh toán", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  processing: { label: "Đang xử lý", color: "bg-blue-100 text-blue-800 border-blue-200" },
  completed: { label: "Hoàn thành", color: "bg-green-100 text-green-800 border-green-200" },
  expired: { label: "Hết hạn", color: "bg-gray-100 text-gray-600 border-gray-200" },
} as const;

function StatusBadge({ status }: { status: RemittanceRecord["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── Countdown timer ───────────────────────────────────────────────────────────

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const urgent = remaining < 60 && remaining > 0;

  return (
    <div className={`text-center p-4 rounded-xl border-2 ${urgent ? "border-red-300 bg-red-50" : "border-yellow-300 bg-yellow-50"}`}>
      <p className="text-xs text-gray-500 mb-1">Thời gian còn lại để gửi VND</p>
      <p className={`text-3xl font-mono font-bold ${urgent ? "text-red-600" : "text-yellow-700"}`}>
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </p>
      {remaining === 0 && (
        <p className="text-xs text-red-500 mt-1">Giao dịch đã hết hạn</p>
      )}
    </div>
  );
}

// ── Proof upload ──────────────────────────────────────────────────────────────

function ProofUpload({ txId, onSuccess }: { txId: string; onSuccess: () => void }) {
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

      const res = await fetch(`/api/remittance/${txId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofImageBase64: base64,
          proofImageMimeType: file.type || "image/jpeg",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Upload thất bại");
        return;
      }

      onSuccess();
    } catch {
      setError("Lỗi khi upload ảnh");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-3">
      <p className="text-sm font-medium text-gray-700">
        Upload ảnh chứng minh đã chuyển VND
      </p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
      />
      {error && <p className="text-red-600 text-sm">⚠️ {error}</p>}
      <button
        type="submit"
        disabled={!file || loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
      >
        {loading ? "Đang gửi..." : "Xác nhận đã chuyển VND"}
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransactionStatusPage() {
  const { txId } = useParams<{ txId: string }>();
  const [record, setRecord] = useState<RemittanceRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRecord = useCallback(async () => {
    try {
      const res = await fetch(`/api/remittance/${txId}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) return;
      const data: RemittanceRecord = await res.json();
      setRecord(data);
      // Stop polling when terminal state
      if (data.status === "completed" || data.status === "expired") {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    } catch { /* ignore */ }
  }, [txId]);

  useEffect(() => {
    fetchRecord();
    pollingRef.current = setInterval(fetchRecord, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchRecord]);

  if (notFound) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Không tìm thấy giao dịch</p>
          <a href="/send" className="text-indigo-600 text-sm mt-2 block">← Tạo giao dịch mới</a>
        </div>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Đang tải...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Chi tiết giao dịch</h1>
            <StatusBadge status={record.status} />
          </div>
          <p className="text-xs text-gray-400 font-mono break-all">{record.txId}</p>
        </div>

        {/* Amounts */}
        <div className="bg-white rounded-2xl shadow p-6 space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Số tiền</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Gửi</p>
              <p className="font-bold text-gray-900">{record.vndAmount.toLocaleString()}</p>
              <p className="text-xs text-gray-400">VND</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Escrow</p>
              <p className="font-bold text-indigo-700">{record.usdcEquivalent.toFixed(4)}</p>
              <p className="text-xs text-gray-400">USDC</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Nhận</p>
              <p className="font-bold text-emerald-700">{record.phpPayout.toFixed(2)}</p>
              <p className="text-xs text-gray-400">PHP</p>
            </div>
          </div>
        </div>

        {/* Receiver */}
        <div className="bg-white rounded-2xl shadow p-6 space-y-2">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Người nhận</h2>
          <p className="text-gray-900">{record.receiverName}</p>
          <p className="text-gray-500 text-sm font-mono">{record.receiverAccount}</p>
        </div>

        {/* Countdown + Upload (only when funded) */}
        {record.status === "funded" && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <CountdownTimer expiresAt={record.expiresAt} />
            <div className="border-t pt-4">
              <ProofUpload txId={record.txId} onSuccess={fetchRecord} />
            </div>
          </div>
        )}

        {/* Processing state */}
        {record.status === "processing" && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">⏳</div>
            <p className="font-semibold text-blue-800">Đang chờ Agent xác nhận</p>
            <p className="text-sm text-blue-600 mt-1">Agent đang gửi PHP cho người nhận</p>
          </div>
        )}

        {/* Completed */}
        {record.status === "completed" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-green-800">Giao dịch hoàn thành!</p>
            {record.stellarTxHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${record.stellarTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 underline mt-2 block"
              >
                Xem trên Stellar Explorer ↗
              </a>
            )}
          </div>
        )}

        {/* Expired */}
        {record.status === "expired" && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">⏰</div>
            <p className="font-semibold text-gray-700">Giao dịch đã hết hạn</p>
            <p className="text-sm text-gray-500 mt-1">USDC đã được hoàn trả về Agent</p>
            <a href="/send" className="text-indigo-600 text-sm mt-3 block">← Tạo giao dịch mới</a>
          </div>
        )}

        {/* Proof images */}
        {record.senderProofRef && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-gray-700 text-sm mb-3">Ảnh chứng minh VND</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={record.senderProofRef} alt="Sender proof" className="rounded-xl max-h-48 object-contain w-full" />
          </div>
        )}
      </div>
    </main>
  );
}
