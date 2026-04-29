"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calculateAmounts } from "@/lib/config";
import { useWallet } from "@/components/wallet-provider";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  User,
  Send,
  Info,
  DollarSign,
  AlertCircle,
  LogOut,
  Building2,
} from "lucide-react";

type Step = "amount" | "receiver" | "review";

export default function SendMoneyPage() {
  const router = useRouter();
  const { address, bankInfo, disconnect } = useWallet();
  const [step, setStep] = useState<Step>("amount");
  const [vndAmount, setVndAmount] = useState<string>("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseFloat(vndAmount);
  const preview = !isNaN(parsed) && parsed > 0 ? calculateAmounts(parsed) : null;

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/remittance/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vndAmount: parsed, receiverName, receiverAccount }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "INSUFFICIENT_LIQUIDITY") {
          setError(
            `Insufficient liquidity. Required ${data.details?.required?.toFixed(4)} USDC, available ${data.details?.available?.toFixed(4)} USDC.`
          );
        } else {
          setError(data.error ?? "Something went wrong.");
        }
        setStep("amount");
        return;
      }
      router.push(`/tx/${data.txId}`);
    } catch {
      setError("Cannot connect to server.");
      setStep("amount");
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { id: "amount", label: "Amount" },
    { id: "receiver", label: "Receiver" },
    { id: "review", label: "Review" },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);

  return (
    <main className="min-h-screen bg-[#f9f9ff] flex flex-col">
      {/* Header */}
      <nav className="h-20 bg-white border-b border-outline/10 px-8 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() =>
              step === "amount"
                ? router.push("/")
                : setStep(step === "receiver" ? "amount" : "receiver")
            }
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Send Money</h1>
            {bankInfo && (
              <p className="text-xs text-gray-400">
                {bankInfo.bankName} · {bankInfo.accountNumber}
              </p>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="hidden md:flex items-center gap-4">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s.id
                    ? "bg-primary text-white"
                    : currentIdx > idx
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {currentIdx > idx ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className={`text-sm font-semibold ${step === s.id ? "text-gray-900" : "text-gray-400"}`}>
                {s.label}
              </span>
              {idx < steps.length - 1 && <div className="w-6 h-[2px] bg-gray-100" />}
            </div>
          ))}
        </div>

        <button
          onClick={disconnect}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Disconnect</span>
        </button>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-xl w-full space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div className="bg-white rounded-[32px] premium-shadow border border-outline/5 overflow-hidden">
            {/* Step: Amount */}
            {step === "amount" && (
              <div className="p-10 space-y-8">
                <div className="space-y-2 text-center">
                  <h2 className="text-3xl font-bold text-gray-900">How much to send?</h2>
                  <p className="text-gray-500">Enter the amount in VND</p>
                </div>

                {/* Sender bank info display */}
                {bankInfo && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-outline/5">
                    <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700">{bankInfo.bankName}</span>
                      <span className="text-gray-400 mx-2">·</span>
                      <span className="font-mono text-gray-600">{bankInfo.accountNumber}</span>
                      <span className="text-gray-400 mx-2">·</span>
                      <span className="text-gray-600">{bankInfo.accountHolder}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="relative">
                    <label className="absolute left-6 top-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      You Send
                    </label>
                    <input
                      type="number"
                      value={vndAmount}
                      onChange={(e) => setVndAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-gray-50 border-none rounded-3xl px-6 pt-10 pb-6 text-3xl font-bold text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-200"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-white px-3 py-2 rounded-xl shadow-sm border border-outline/5">
                      <span className="text-sm font-bold text-gray-900">VND</span>
                    </div>
                  </div>

                  {preview && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 px-2">
                        <div className="flex-1 h-[1px] bg-gray-100" />
                        <div className="p-2 bg-primary/5 rounded-full">
                          <ArrowRight className="w-4 h-4 text-primary rotate-90" />
                        </div>
                        <div className="flex-1 h-[1px] bg-gray-100" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-5 rounded-3xl border border-outline/5 space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">USDC Escrow</p>
                          <p className="text-xl font-bold text-gray-900">{preview.usdcEquivalent.toFixed(4)}</p>
                        </div>
                        <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 space-y-1">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">Receiver Gets</p>
                          <p className="text-xl font-bold text-emerald-700">{preview.phpPayout.toFixed(2)} PHP</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-5 py-3.5 bg-primary/5 rounded-2xl">
                        <Info className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-xs text-primary font-medium">Fixed rate · No hidden fees</p>
                      </div>
                    </div>
                  )}

                  <button
                    disabled={!parsed || parsed < 1000}
                    onClick={() => setStep("receiver")}
                    className="w-full btn-primary h-14 rounded-2xl text-base flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            )}

            {/* Step: Receiver */}
            {step === "receiver" && (
              <div className="p-10 space-y-8">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-gray-900">Who is receiving?</h2>
                  <p className="text-gray-500">Enter the receiver&apos;s details in Philippines</p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Full Name
                    </label>
                    <input
                      type="text"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="Juan dela Cruz"
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-2 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> GCash / Account Number
                    </label>
                    <input
                      type="text"
                      value={receiverAccount}
                      onChange={(e) => setReceiverAccount(e.target.value)}
                      placeholder="09XXXXXXXXX"
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button onClick={() => setStep("amount")} className="flex-1 btn-secondary h-14 rounded-2xl">
                      Back
                    </button>
                    <button
                      disabled={!receiverName || !receiverAccount}
                      onClick={() => setStep("review")}
                      className="flex-[2] btn-primary h-14 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Review Order
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step: Review */}
            {step === "review" && (
              <div className="p-10 space-y-8">
                <div className="space-y-2 text-center">
                  <h2 className="text-3xl font-bold text-gray-900">Review & Send</h2>
                  <p className="text-gray-500">Confirm before creating the escrow</p>
                </div>

                <div className="bg-gray-50 rounded-3xl p-8 space-y-5 border border-outline/5">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">You Send</p>
                      <p className="text-2xl font-bold text-gray-900">{parsed.toLocaleString()} VND</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">They Receive</p>
                      <p className="text-2xl font-bold text-emerald-700">{preview?.phpPayout.toFixed(2)} PHP</p>
                    </div>
                  </div>

                  <div className="h-[1px] bg-gray-200" />

                  {bankInfo && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">From (Sender)</p>
                      <p className="text-sm text-gray-700">
                        {bankInfo.accountHolder} · {bankInfo.bankName} · <span className="font-mono">{bankInfo.accountNumber}</span>
                      </p>
                    </div>
                  )}

                  <div className="h-[1px] bg-gray-200" />

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Receiver</p>
                      <p className="font-semibold text-gray-900 mt-1">{receiverName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account</p>
                      <p className="font-semibold text-gray-900 font-mono mt-1">{receiverAccount}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    disabled={loading}
                    onClick={handleSubmit}
                    className="w-full btn-primary h-16 rounded-2xl text-lg flex items-center justify-center gap-3 group shadow-lg shadow-primary/20 disabled:opacity-60"
                  >
                    <Send className={`w-5 h-5 ${loading ? "animate-pulse" : "group-hover:-translate-y-0.5 transition-transform"}`} />
                    {loading ? "Creating Escrow..." : "Confirm & Send"}
                  </button>
                  <p className="text-center text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em]">
                    Secured by Soroban Smart Contract
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
