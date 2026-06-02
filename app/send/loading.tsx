import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f9f9ff] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-primary">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="font-bold text-sm tracking-widest uppercase">Loading Sender Dashboard...</p>
      </div>
    </div>
  );
}
