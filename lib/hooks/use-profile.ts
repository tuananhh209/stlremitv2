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

function cacheKey(address: string) {
  return `stl_profile_${address}`;
}

function readCache(address: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(address));
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function writeCache(address: string, profile: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(address), JSON.stringify(profile));
  } catch { /* ignore */ }
}

function clearCache(address: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(cacheKey(address));
  } catch { /* ignore */ }
}

export function useProfile() {
  const { address } = useWallet();

  // Initialise from localStorage immediately — no loading flash
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined" || !address) return null;
    return readCache(address);
  });

  // loading = true only when we have NO cache at all
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined" || !address) return true;
    return readCache(address) === null;
  });

  const fetchProfile = useCallback(async () => {
    if (!address) { setLoading(false); return; }

    // Seed from cache first so guard shows instantly
    const cached = readCache(address);
    if (cached) {
      setProfile(cached);
      setLoading(false);
    }

    try {
      const res = await fetch(`/api/profile?wallet=${address}`);
      if (res.ok) {
        const data: UserProfile | null = await res.json();
        setProfile(data);
        if (data) writeCache(address, data);
        else clearCache(address);
      } else {
        setProfile(null);
        clearCache(address);
      }
    } catch {
      // keep cached value on network error
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Re-init when address changes (e.g. different wallet)
  useEffect(() => {
    if (!address) { setProfile(null); setLoading(false); return; }
    const cached = readCache(address);
    setProfile(cached);
    setLoading(cached === null); // only show loading if no cache
    fetchProfile();
  }, [address, fetchProfile]);

  function isBankInfoComplete(role: string | null): boolean {
    if (!profile) return false;
    if (role === "agent") {
      return !!(
        profile.agentBankName &&
        profile.agentAccountNumber &&
        profile.agentAccountHolder
      );
    }
    return !!(
      profile.bankName &&
      profile.accountNumber &&
      profile.accountHolder
    );
  }

  return { profile, loading, isBankInfoComplete, refetch: fetchProfile };
}
