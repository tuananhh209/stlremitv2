import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🌏</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">STL Remit</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Cross-border remittance powered by Stellar blockchain
        </p>

        <div className="space-y-3">
          <Link
            href="/send"
            className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            💸 Send Money (Sender)
          </Link>
          <Link
            href="/agent"
            className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            🏦 Agent Dashboard
          </Link>
        </div>

        <p className="mt-8 text-xs text-gray-400">
          Stellar Testnet · Soroban Escrow Contract
        </p>
      </div>
    </main>
  );
}
