import { describe, expect, test } from "@jest/globals";

import { envSchema } from "../lib/env-schema";

/** The variables the application genuinely cannot start without. */
const required = {
  DATABASE_URL: "postgresql://user:pass@host/db?sslmode=require",
  NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
  NEXT_PUBLIC_STELLAR_RPC_URL: "https://mainnet.sorobanrpc.com",
  ESCROW_CONTRACT_ID: "CCNRSZLLMHW36GOZQPR5VRRMNB5CH7AXOZMFN4KURNIQSO7LKELG65DE",
  AGENT_SECRET_KEY: "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  AGENT_PUBLIC_KEY: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};

describe("required variables", () => {
  test("the minimum set parses", () => {
    expect(envSchema.safeParse(required).success).toBe(true);
  });

  test("a missing one is refused", () => {
    for (const key of Object.keys(required)) {
      const { [key]: _dropped, ...rest } = required as Record<string, string>;
      expect(envSchema.safeParse(rest).success).toBe(false);
    }
  });

  test("the network must be exactly mainnet", () => {
    for (const value of ["MAINNET", "Mainnet", "testnet", "public"]) {
      const result = envSchema.safeParse({ ...required, NEXT_PUBLIC_STELLAR_NETWORK: value });
      expect(result.success).toBe(false);
    }
  });
});

describe("empty optional variables", () => {
  // This is the build failure: Docker turns an ARG without a default into an
  // empty ENV, and an empty string is a present value that still has to pass
  // .url() — so an optional variable nobody set broke the production build.
  test("an empty NEXT_PUBLIC_APP_URL no longer fails the build", () => {
    const result = envSchema.safeParse({ ...required, NEXT_PUBLIC_APP_URL: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.NEXT_PUBLIC_APP_URL).toBeUndefined();
  });

  test("every optional variable tolerates an empty value", () => {
    const optionalKeys = [
      "NEXT_PUBLIC_APP_URL",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
      "USDC_TOKEN_ID",
    ];
    for (const key of optionalKeys) {
      const result = envSchema.safeParse({ ...required, [key]: "" });
      expect(result.success).toBe(true);
    }
  });

  test("all of them empty at once still parses", () => {
    const result = envSchema.safeParse({
      ...required,
      NEXT_PUBLIC_APP_URL: "",
      CLOUDINARY_CLOUD_NAME: "",
      CLOUDINARY_API_KEY: "",
      CLOUDINARY_API_SECRET: "",
      USDC_TOKEN_ID: "",
    });
    expect(result.success).toBe(true);
  });

  test("omitting them entirely also parses", () => {
    expect(envSchema.safeParse(required).success).toBe(true);
  });
});

describe("optional variables that are set", () => {
  test("a real value is kept", () => {
    const result = envSchema.safeParse({
      ...required,
      NEXT_PUBLIC_APP_URL: "https://stlremitv2-production.up.railway.app",
      CLOUDINARY_CLOUD_NAME: "stlremit",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe("https://stlremitv2-production.up.railway.app");
      expect(result.data.CLOUDINARY_CLOUD_NAME).toBe("stlremit");
    }
  });

  test("a value that is set but malformed is still refused", () => {
    // Tolerating "" must not become tolerating anything: a typo in a real URL
    // should still stop the build rather than ship a broken link.
    const result = envSchema.safeParse({ ...required, NEXT_PUBLIC_APP_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });
});

describe("the Dockerfile build environment", () => {
  test("the placeholder values in the image pass validation", () => {
    // Mirrors the ENV lines in the Dockerfile, which exist so the build can
    // complete before Railway injects the real values at runtime.
    const result = envSchema.safeParse({
      DATABASE_URL: "postgresql://x:x@x/x?sslmode=require",
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://mainnet.sorobanrpc.com",
      ESCROW_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      AGENT_SECRET_KEY: "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      AGENT_PUBLIC_KEY: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      CLOUDINARY_CLOUD_NAME: "placeholder",
      CLOUDINARY_API_KEY: "000000000000000",
      CLOUDINARY_API_SECRET: "placeholder",
      USDC_TOKEN_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      NEXT_PUBLIC_APP_URL: "",
    });
    expect(result.success).toBe(true);
  });
});
