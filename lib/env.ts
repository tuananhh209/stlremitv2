import { z } from "zod";
import { loadEnvConfig } from "@next/env";
import path from "path";

if (typeof window === "undefined" && !process.env.DATABASE_URL) {
  const originalEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "development";
  loadEnvConfig(path.resolve(__dirname, ".."));
  (process.env as any).NODE_ENV = originalEnv;
}

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  ESCROW_CONTRACT_ID: z.string().min(1, "ESCROW_CONTRACT_ID is required"),
  AGENT_SECRET_KEY: z.string().min(1, "AGENT_SECRET_KEY is required"),
  AGENT_PUBLIC_KEY: z.string().min(1, "AGENT_PUBLIC_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required").optional(),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required").optional(),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required").optional(),
  USDC_TOKEN_ID: z.string().min(1, "USDC_TOKEN_ID is required").optional(),
});

const _env = process.env.SKIP_ENV_VALIDATION === "true" 
  ? { success: true as const, data: process.env as any } 
  : envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", ('error' in _env) ? _env.error.format() : "");
  throw new Error("Invalid environment variables");
}

export const env = _env.data;
