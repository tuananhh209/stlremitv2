"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet-provider";

export default function Home() {
  const { isConnected, role } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected) return;
    if (role === "sender") router.replace("/send");
    else if (role === "agent") router.replace("/agent");
    else if (role === "receiver") router.replace("/receiver");
    // If no role yet, AppGate will handle showing the role/bank selection screens
  }, [isConnected, role, router]);

  // AppGate handles all the connect/role/bank steps before rendering children
  return null;
}
