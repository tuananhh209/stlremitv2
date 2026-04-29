"use client";

import Link from "next/link";
import { ConnectWallet } from "@/components/connect-wallet";
import { useWallet } from "@/components/wallet-provider";
import { ArrowRight, Globe2, ShieldCheck, Zap } from "lucide-react";

export default function Home() {
  const { isConnected } = useWallet();

  return (
    <main className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />

      <div className="container max-w-6xl px-6 py-12 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left: Content */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold tracking-wider uppercase">
            <Globe2 className="w-3 h-3" />
            Next-Gen Remittance
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
            Global money <br />
            <span className="text-primary">transfer</span> simplified.
          </h1>
          
          <p className="text-lg text-gray-600 max-w-lg leading-relaxed">
            Send money across borders instantly using the Stellar blockchain. 
            Secure, transparent, and low-cost escrow-powered remittances.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
            <div className="space-y-2">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-gray-900">Instant</h3>
              <p className="text-xs text-gray-500">Settled in seconds on Stellar</p>
            </div>
            <div className="space-y-2">
              <ShieldCheck className="w-5 h-5 text-secondary" />
              <h3 className="font-semibold text-gray-900">Secure</h3>
              <p className="text-xs text-gray-500">Soroban Smart Contracts</p>
            </div>
            <div className="space-y-2">
              <Globe2 className="w-5 h-5 text-tertiary" />
              <h3 className="font-semibold text-gray-900">Global</h3>
              <p className="text-xs text-gray-500">Anywhere, anytime</p>
            </div>
          </div>
        </div>

        {/* Right: Action Card */}
        <div className="glass-card p-8 lg:p-10 rounded-3xl premium-shadow space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Get Started</h2>
            <p className="text-sm text-gray-500">Connect your Stellar wallet to send or receive money.</p>
          </div>

          <ConnectWallet />

          {isConnected && (
            <div className="grid grid-cols-1 gap-3 pt-4 border-t border-outline/10">
              <Link
                href="/send"
                className="btn-primary w-full flex items-center justify-center gap-2 group"
              >
                Send Money (Sender)
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/agent"
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                Agent Dashboard
              </Link>
            </div>
          )}

          <div className="text-center">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em]">
              Powered by Soroban · Stellar Testnet
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

