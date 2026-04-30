"use client";

import { useState, useRef } from "react";
import { QrCode, Upload, CheckCircle2, Loader2, X } from "lucide-react";

interface QrUploadProps {
  currentUrl: string | null;
  walletAddress: string;
  field: "qr" | "agentQr";
  label?: string;
  onUploaded: (url: string) => void;
}

export function QrUpload({ currentUrl, walletAddress, field, label = "Bank QR Code", onUploaded }: QrUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      // Read as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreview(base64);

      const res = await fetch("/api/upload-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, walletAddress, field }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Upload failed");
      }

      const { url } = await res.json();
      setPreview(url);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(currentUrl);
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <QrCode className="w-3.5 h-3.5" />
        {label}
      </label>

      {/* Preview */}
      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="QR Code"
            className="w-40 h-40 object-contain rounded-2xl border border-outline/10 bg-white p-2 shadow-sm"
          />
          {!uploading && (
            <button
              type="button"
              onClick={() => { setPreview(null); onUploaded(""); if (inputRef.current) inputRef.current.value = ""; }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-sm"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Drop zone */}
      {!preview && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-outline/20 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group"
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-primary group-hover:bg-primary/10 transition-all">
              <Upload className="w-6 h-6" />
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-bold text-gray-700 group-hover:text-primary transition-colors">
              {uploading ? "Uploading..." : "Click or drag to upload QR"}
            </p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
          </div>
        </div>
      )}

      {/* Change button when preview exists */}
      {preview && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 text-xs font-bold text-primary hover:underline"
        >
          <Upload className="w-3.5 h-3.5" /> Change QR image
        </button>
      )}

      {error && <p className="text-xs text-red-500 font-bold">⚠️ {error}</p>}

      {preview && !uploading && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" /> QR saved to Cloudinary
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
