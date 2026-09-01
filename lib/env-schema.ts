import { z } from "zod";

/**
 * Treats an empty environment variable as an absent one.
 *
 * `.optional()` accepts `undefined`, not `""` — and a Docker `ARG` with no
 * default becomes an empty string, not an unset variable:
 *
 *     ARG NEXT_PUBLIC_APP_URL
 *     ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}   # -> ""
 *
 * So an optional variable nobody set arrived as a defined value that then
 * failed its own format check, and the production build died on `Invalid URL`
 * for a variable that was never required. Every optional entry goes through
 * this, because the same thing happens to all of them.
 */
export const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

/**
 * The schema on its own, with no side effects, so it can be exercised without
 * importing the module that validates `process.env` and throws.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  NEXT_PUBLIC_STELLAR_NETWORK: z.literal("mainnet"),
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().url("NEXT_PUBLIC_STELLAR_RPC_URL must be a valid URL"),
  ESCROW_CONTRACT_ID: z.string().min(1, "ESCROW_CONTRACT_ID is required"),
  AGENT_SECRET_KEY: z.string().min(1, "AGENT_SECRET_KEY is required"),
  AGENT_PUBLIC_KEY: z.string().min(1, "AGENT_PUBLIC_KEY is required"),
  NEXT_PUBLIC_APP_URL: optional(z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL")),
  CLOUDINARY_CLOUD_NAME: optional(z.string().min(1)),
  CLOUDINARY_API_KEY: optional(z.string().min(1)),
  CLOUDINARY_API_SECRET: optional(z.string().min(1)),
  USDC_TOKEN_ID: optional(z.string().min(1)),
});

export type Env = z.infer<typeof envSchema>;
