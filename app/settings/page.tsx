"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet-provider";
import { WalletMenu } from "@/components/wallet-menu";
import {
  Settings,
  Building2,
  CreditCard,
  User,
  CheckCircle2,
  ArrowLeft,
  Save,
  Loader2,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Bank lists ────────────────────────────────────────────────────────────────
const SENDER_BANKS = ["Vietcombank", "Techcombank", "BIDV", "VPBank", "MB Bank", "ACB", "Sacombank", "TPBank"];
const RECEIVER_BANKS = ["BDO", "BPI", "Metrobank", "UnionBank", "PNB", "Landbank", "GCash", "Maya"];
const AGENT_BANKS = ["Vietcombank", "Techcombank", "BIDV", "VPBank", "MB Bank", "ACB", "Sacombank", "TPBank"];

// ── Field component ───────────────────────────────────────────────────────────
function Field({
  label, icon: Icon, children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const { address, role } = useWallet();

  // Form state
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  // Agent extra (their own bank to receive VND from senders)
  const [agentBankName, setAgentBankName] = useState("");
  const [agentAccountNumber, setAgentAccountNumber] = useState("");
  const [agentAccountHolder, setAgentAccountHolder] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing profile
  const loadProfile = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/profile?wallet=${address}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setBankName(data.bankName ?? "");
          setAccountNumber(data.accountNumber ?? "");
          setAccountHolder(data.accountHolder ?? "");
          setAgentBankName(data.agentBankName ?? "");
          setAgentAccountNumber(data.agentAccountNumber ?? "");
          setAgentAccountHolder(data.agentAccountHolder ?? "");
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [address]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !role) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          role,
          bankName: bankName || null,
          accountNumber: accountNumber || null,
          accountHolder: accountHolder || null,
          agentBankName: agentBankName || null,
          agentAccountNumber: agentAccountNumber || null,
          agentAccountHolder: agentAccountHolder || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await res.json();
        setError(d.error ?? "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const backPath = role === "agent" ? "/agent" : role === "receiver" ? "/receiver" : "/send";

  const bankList =
    role === "sender" ? SENDER_BANKS :
    role === "receiver" ? RECEIVER_BANKS :
    AGENT_BANKS;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f9f9ff] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f9f9ff]">
      {/* Header */}
      <header className="h-24 bg-white/80 backdrop-blur-md border-b border-outline/5 px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(backPath)}
            className="p-3 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-outline/10 group"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-gray-900" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-400 font-medium mt-0.5 capitalize">{role} Profile</p>
          </div>
        </div>
        <WalletMenu />
      </header>

      <div className="max-w-2xl mx-auto p-8 space-y-8">

        {/* Role badge */}
        <div className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest",
          role === "agent" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
          role === "receiver" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
          "bg-primary/10 text-primary border border-primary/20"
        )}>
          <Settings className="w-3.5 h-3.5" />
          {role === "sender" ? "💸 Sender" : role === "receiver" ? "📥 Receiver" : "🏦 Agent"} Settings
        </div>

        <form onSubmit={handleSave} className="space-y-8">

          {/* ── Sender / Receiver: bank info ── */}
          {(role === "sender" || role === "receiver") && (
            <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-10 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {role === "sender" ? "Your Vietnamese Bank Account" : "Your Philippine Payout Account"}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {role === "sender"
                    ? "This is the account you'll use to send VND to the agent."
                    : "This is the account where you'll receive PHP payouts."}
                </p>
              </div>

              <Field label={role === "sender" ? "Vietnamese Bank" : "Philippine Bank / E-Wallet"} icon={Building2}>
                <select
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">Select bank...</option>
                  {bankList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>

              <Field label="Account Number" icon={CreditCard}>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder={role === "sender" ? "0123456789" : "09XXXXXXXXX"}
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </Field>

              <Field label="Account Holder Name" icon={User}>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={e => setAccountHolder(e.target.value)}
                  placeholder="Full name as on bank account"
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </Field>
            </div>
          )}

          {/* ── Agent: bank account to receive VND from senders ── */}
          {role === "agent" && (
            <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-10 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Your Bank Account (Receive VND)</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Senders will transfer VND to this account after you accept their request.
                </p>
              </div>

              <Field label="Vietnamese Bank" icon={Building2}>
                <select
                  value={agentBankName}
                  onChange={e => setAgentBankName(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">Select bank...</option>
                  {AGENT_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>

              <Field label="Account Number" icon={CreditCard}>
                <input
                  type="text"
                  value={agentAccountNumber}
                  onChange={e => setAgentAccountNumber(e.target.value)}
                  placeholder="0123456789"
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </Field>

              <Field label="Account Holder Name" icon={User}>
                <input
                  type="text"
                  value={agentAccountHolder}
                  onChange={e => setAgentAccountHolder(e.target.value)}
                  placeholder="Full name as on bank account"
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </Field>
            </div>
          )}

          {/* Wallet info (read-only) */}
          <div className="bg-white rounded-[40px] premium-shadow border border-outline/5 p-10 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Wallet</h2>
            <div className="bg-gray-50 rounded-2xl px-5 py-4 border border-outline/5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Connected Address</p>
              <p className="text-sm font-mono text-gray-700 break-all">{address}</p>
            </div>
            <p className="text-xs text-gray-400">Role: <span className="font-bold capitalize text-gray-700">{role}</span></p>
          </div>

          {/* Save button */}
          {error && <p className="text-center text-sm text-red-500 font-bold">⚠️ {error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full btn-primary h-16 rounded-[24px] font-bold text-sm shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : saved ? (
              <><CheckCircle2 className="w-5 h-5" /> Saved!</>
            ) : (
              <><Save className="w-5 h-5" /> Save Settings</>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
