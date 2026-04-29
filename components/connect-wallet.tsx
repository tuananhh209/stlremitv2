"use client";

import React from "react";
import { useWallet } from "./wallet-provider";
import { Wallet, CheckCircle2, LogOut } from "lucide-react";

export function ConnectWallet() {
  const { address, connect, disconnect, isConnected, walletType } = useWallet();

  if (isConnected) {
    return (
      <div className="flex flex-col gap-4">
        <div className="p-4 bg-secondary/10 border border-secondary/20 rounded-xl flex items-center gap-3">
          <div className="bg-secondary p-2 rounded-full">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-secondary font-semibold uppercase tracking-wider">
              Connected · {walletType}
            </p>
            <p className="text-sm font-mono truncate">{address}</p>
          </div>
          <button
            onClick={disconnect}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <button
        onClick={() => connect("freighter")}
        className="flex items-center justify-between p-4 bg-white border border-outline/20 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">Freighter</p>
            <p className="text-xs text-gray-500">Stellar Browser Extension</p>
          </div>
        </div>
        <div className="w-2 h-2 rounded-full bg-primary/20 group-hover:bg-primary transition-colors" />
      </button>

      <button
        onClick={() => connect("rabet")}
        className="flex items-center justify-between p-4 bg-white border border-outline/20 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
            <Wallet className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">Rabet</p>
            <p className="text-xs text-gray-500">Fast & Secure Stellar Wallet</p>
          </div>
        </div>
        <div className="w-2 h-2 rounded-full bg-indigo-200 group-hover:bg-indigo-500 transition-colors" />
      </button>
    </div>
  );
}
