import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { profileAuthMessage } from "./profile-auth-message";

const MAX_SIGNATURE_AGE_MS = 5 * 60_000;

export function verifyProfileSignature(
  profile: Record<string, unknown>,
  timestamp: string,
  signature: string,
  now = Date.now(),
): boolean {
  const signedAt = Number(timestamp);
  if (!Number.isFinite(signedAt) || Math.abs(now - signedAt) > MAX_SIGNATURE_AGE_MS) return false;
  try {
    const message = `Stellar Signed Message:\n${profileAuthMessage(profile, timestamp)}`;
    const digest = createHash("sha256").update(message).digest();
    return Keypair.fromPublicKey(String(profile.walletAddress)).verify(digest, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
