"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "./wallet-provider";
import { Copy, LogOut, CheckCheck } from "lucide-react";

export function WalletMenu() {
  const { address, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleCopy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!address) return null;

  const initial = address[0].toUpperCase();
  const short = `${address.slice(0, 6)}...${address.slice(-6)}`;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger row */}
      <div className="flex items-center gap-3 pl-6 border-l border-outline/10">
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Connected Wallet</p>
          <p className="text-xs font-mono text-gray-900 font-bold">{short}</p>
        </div>
        {/* Avatar button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-bold border border-primary/20 shadow-sm hover:bg-primary/20 transition-all select-none"
          aria-label="Wallet menu"
        >
          {initial}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] w-64 bg-white rounded-2xl shadow-2xl border border-outline/10 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Address header */}
          <div className="px-5 py-4 bg-gray-50 border-b border-outline/5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Wallet Address</p>
            <p className="text-xs font-mono text-gray-700 break-all">{address}</p>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all text-sm font-bold text-gray-700 group"
            >
              {copied
                ? <CheckCheck className="w-4 h-4 text-emerald-500" />
                : <Copy className="w-4 h-4 text-gray-400 group-hover:text-gray-700" />}
              {copied ? "Copied!" : "Copy Address"}
            </button>

            <button
              onClick={() => { setOpen(false); disconnect(); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition-all text-sm font-bold text-red-500 group"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
