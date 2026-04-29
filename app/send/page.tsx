"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calculateAmounts } from "@/lib/config";

export default function SendMoneyPage() {
  const router = useRouter();
  const [vndAmount, setVndAmount] = useState<string>("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseFloat(vndAmount);
  const preview =
    !isNaN(parsed) && parsed > 0 ? calculateAmounts(parsed) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/remittance/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vndAmount: parsed,
          receiverName,
          receiverAccount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "INSUFFICIENT_LIQUIDITY") {
          setError(
            `Không đủ thanh khoản. Cần ${data.details?.required?.toFixed(4)} USDC, hiện có ${data.details?.available?.toFixed(4)} USDC.`
          );
        } else {
          setError(data.error ?? "Có lỗi xảy ra, vui lòng thử lại.");
        }
        return;
      }

      router.push(`/tx/${data.txId}`);
    } catch {
      setError("Không thể kết nối server. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">💸</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gửi tiền</h1>
            <p className="text-sm text-gray-500">VND → PHP qua Stellar</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* VND Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số tiền VND
            </label>
            <div className="relative">
              <input
                type="number"
                min="1000"
                step="1000"
                value={vndAmount}
                onChange={(e) => setVndAmount(e.target.value)}
                placeholder="Ví dụ: 500000"
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
                VND
              </span>
            </div>
          </div>

          {/* Live preview */}
          {preview && (
            <div className="bg-indigo-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">USDC tương đương</span>
                <span className="font-semibold text-indigo-700">
                  {preview.usdcEquivalent.toFixed(4)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Người nhận nhận được</span>
                <span className="font-semibold text-emerald-700">
                  {preview.phpPayout.toFixed(2)} PHP
                </span>
              </div>
            </div>
          )}

          {/* Receiver Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên người nhận
            </label>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          {/* Receiver Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số tài khoản người nhận
            </label>
            <input
              type="text"
              value={receiverAccount}
              onChange={(e) => setReceiverAccount(e.target.value)}
              placeholder="09XXXXXXXXX"
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !vndAmount || !receiverName || !receiverAccount}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? "Đang xử lý..." : "Tạo lệnh chuyển tiền"}
          </button>
        </form>
      </div>
    </main>
  );
}
