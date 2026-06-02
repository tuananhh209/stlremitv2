import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";
import { AppGate } from "@/components/app-gate";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "STL Remit — Cross-Border Remittance",
  description: "Send VND to Philippines via Stellar blockchain escrow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <WalletProvider>
          <AppGate>{children}</AppGate>
        </WalletProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
