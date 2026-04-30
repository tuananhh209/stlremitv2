"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/components/wallet-provider";

export interface UserProfile {
  walletAddress: string;
  role: string;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  qrImageUrl: string | null;
  agentBankName: string | null;
  agentAccountNumber: string | null;
  agentAccountHolder: string | null;
  agentQrImageUrl: string | null;
}

export function useProfile() {
  const { address } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!address) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/profile?wallet=${address}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  function isBankInfoComplete(role: string | null): boolean {
    if (!profile) return false;
    if (role === "agent") {
      return !!(profile.agentBankName && profile.agentAccountNumber && profile.agentAccountHolder);
    }
    return !!(profile.bankName && profile.accountNumber && profile.accountHolder);
  }

  return { profile, loading, isBankInfoComplete, refetch: fetchProfile };
}
