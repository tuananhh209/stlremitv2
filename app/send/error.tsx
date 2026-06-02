"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col items-center justify-center p-8">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong!</h2>
      <p className="text-gray-500 mb-8 max-w-md text-center">{error.message}</p>
      <button
        onClick={() => reset()}
        className="bg-primary text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center gap-3 hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="w-5 h-5" /> Try again
      </button>
    </div>
  );
}
