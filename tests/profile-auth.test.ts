import { createHash } from "node:crypto";
import { expect, jest, test } from "@jest/globals";
import { profileAuthMessage, verifyProfileSignature } from "../lib/profile-auth";

const mockVerify = jest.fn((digest: Buffer, signature: Buffer) => digest.equals(signature));
jest.mock("@stellar/stellar-sdk", () => ({
  Keypair: { fromPublicKey: () => ({ verify: mockVerify }) },
}));

test("verifies the owner and rejects changed or expired profiles", () => {
  const timestamp = "1776000000000";
  const profile = { walletAddress: `G${"A".repeat(55)}`, role: "sender", bankName: "ACB" };
  const digest = createHash("sha256")
    .update(`Stellar Signed Message:\n${profileAuthMessage(profile, timestamp)}`)
    .digest();
  const signature = digest.toString("base64");

  expect(verifyProfileSignature(profile, timestamp, signature, Number(timestamp))).toBe(true);
  expect(verifyProfileSignature({ ...profile, bankName: "Other" }, timestamp, signature, Number(timestamp))).toBe(false);
  expect(verifyProfileSignature(profile, timestamp, signature, Number(timestamp) + 300_001)).toBe(false);
});
