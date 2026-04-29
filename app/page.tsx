"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet-provider";

export default function Home() {
  const { role } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (role === "sender") router.replace("/send");
    else if (role === "receiver") router.replace("/receiver");
    else if (role === "agent") router.replace("/agent");
  }, [role, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
