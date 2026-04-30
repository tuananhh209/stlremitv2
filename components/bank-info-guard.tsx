"use client";

import { AlertTriangle, Settings } from "lucide-react";

interface BankInfoGuardProps {
  role: string;
  onGoToSettings: () => void;
}

const MESSAGES: Record<string, { title: string; desc: string }> = {
  sender: {
    title: "Set up your bank account first",
    desc: "You need to add your Vietnamese bank account in Settings before you can send money.",
  },
  receiver: {
    title: "Set up your payout account first",
    desc: "You need to add your Philippine bank / e-wallet in Settings before you can receive payouts.",
  },
  agent: {
    title: "Set up your bank account first",
    desc: "You need to add your Vietnamese bank account in Settings before you can accept remittance requests.",
  },
};

export function BankInfoGuard({ role, onGoToSettings }: BankInfoGuardProps) {
  const msg = MESSAGES[role] ?? MESSAGES.sender;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-md w-full bg-amber-50 border border-amber-200 rounded-[40px] p-12 flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 bg-amber-100 rounded-[24px] flex items-center justify-center text-amber-600">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-amber-900">{msg.title}</h3>
          <p className="text-sm text-amber-700/80 leading-relaxed">{msg.desc}</p>
        </div>
        <button
          onClick={onGoToSettings}
          className="flex items-center gap-2 px-8 h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-amber-200"
        >
          <Settings className="w-4 h-4" />
          Go to Settings
        </button>
      </div>
    </div>
  );
}
