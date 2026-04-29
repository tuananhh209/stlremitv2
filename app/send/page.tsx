"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calculateAmounts } from "@/lib/config";
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
} from "lucide-react";

type Step = "amount" | "receiver" | "review";

export default function SendMoneyPage() {
  const router = useRouter();
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
    { id: "amount", label: "Amount", icon: DollarSign },
    { id: "receiver", label: "Receiver", icon: User },
    { id: "review", label: "Review", icon: Check },
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
          <h1 className="text-xl font-bold text-gray-900">Send Money</h1>
        </div>

        {/* Stepper */}
        <div className="hidden md:flex items-center gap-6">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s.id
                    ? "bg-primary text-white"
                    : currentIdx > idx
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {currentIdx > idx ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span
                className={`text-sm font-semibold ${
                  step === s.id ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
              {idx < steps.length - 1 && (
                <div className="w-8 h-[2px] bg-gray-100" />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Rates
        </div>
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
                  <h2 className="text-3xl font-bold text-gray-900">
                    How much are you sending?
                  </h2>
                  <p className="text-gray-500">
                    Enter the amount in VND to see the conversion.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="relative">
                    <label className="absolute left-6 top-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      You Send
                    </label>
                    <input
                      type="number"
                      value={vndAmount}
                      onChange={(e) => setVndAmount(e.target.value)}
                      placeholder="0.00"
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
                        <div className="bg-gray-50 p-6 rounded-3xl border border-outline/5 space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">
                            USDC Equivalent
                          </p>
                          <p className="text-xl font-bold text-gray-900">
                            {preview.usdcEquivalent.toFixed(4)}
                          </p>
                        </div>
                        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-1">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">
                            Receiver Payout
                          </p>
                          <p className="text-xl font-bold text-emerald-700">
                            {preview.phpPayout.toFixed(2)} PHP
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-6 py-4 bg-primary/5 rounded-2xl">
                        <Info className="w-5 h-5 text-primary shrink-0" />
                        <p className="text-xs text-primary font-medium">
                          Guaranteed exchange rate. No hidden fees.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    disabled={!parsed || parsed < 1000}
                    onClick={() => setStep("receiver")}
                    className="w-full btn-primary h-16 rounded-2xl text-lg flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue to Receiver
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            )}

            {/* Step: Receiver */}
            {step === "receiver" && (
              <div className="p-10 space-y-8">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-gray-900">
                    Who is receiving?
                  </h2>
                  <p className="text-gray-500">
                    Provide the receiver&apos;s full name and account details.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-gray-50 border-none rounded-2xl pl-14 pr-6 py-4 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-2">
                      GCash / Account Number
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={receiverAccount}
                        onChange={(e) => setReceiverAccount(e.target.value)}
                        placeholder="09XXXXXXXXX"
                        className="w-full bg-gray-50 border-none rounded-2xl pl-14 pr-6 py-4 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button
                      onClick={() => setStep("amount")}
                      className="flex-1 btn-secondary h-14 rounded-2xl"
                    >
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
                  <h2 className="text-3xl font-bold text-gray-900">
                    Review & Send
                  </h2>
                  <p className="text-gray-500">
                    Double check the details before creating the escrow.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-3xl p-8 space-y-6 border border-outline/5">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        You are sending
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {parsed.toLocaleString()} VND
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                        They receive
                      </p>
                      <p className="text-2xl font-bold text-emerald-700">
                        {preview?.phpPayout.toFixed(2)} PHP
                      </p>
                    </div>
                  </div>

                  <div className="h-[1px] bg-gray-200" />

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Receiver Name
                      </p>
                      <p className="font-semibold text-gray-900">
                        {receiverName}
                      </p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Account Number
                      </p>
                      <p className="font-semibold text-gray-900 font-mono">
                        {receiverAccount}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    disabled={loading}
                    onClick={handleSubmit}
                    className="w-full btn-primary h-16 rounded-2xl text-lg flex items-center justify-center gap-3 group shadow-lg shadow-primary/20 disabled:opacity-60"
                  >
                    <Send
                      className={`w-5 h-5 ${
                        loading
                          ? "animate-pulse"
                          : "group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform"
                      }`}
                    />
                    {loading ? "Creating Escrow..." : "Confirm & Send"}
                  </button>
                  <p className="text-center text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em]">
                    Secured by Soroban Smart Contract
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-8 text-gray-400">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold">Instant Escrow</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold">Verified Agents</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
