import { loadEnvConfig } from "@next/env";
import path from "path";

import { envSchema } from "./env-schema";

if (typeof window === "undefined" && !process.env.DATABASE_URL) {
  const originalEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "development";
  loadEnvConfig(path.resolve(__dirname, ".."));
  (process.env as any).NODE_ENV = originalEnv;
}

const _env = process.env.SKIP_ENV_VALIDATION === "true"
  ? { success: true as const, data: process.env as any }
  : envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", ('error' in _env) ? _env.error.format() : "");
  throw new Error("Invalid environment variables");
}

export const env = _env.data;
