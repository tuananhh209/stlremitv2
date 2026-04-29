/**
 * Integration tests for the full remittance flow.
 *
 * Tests the complete flow: create → mark-paid → agent-proof → confirm
 * Uses real DB (Neon) and real Stellar testnet contract.
 *
 * Run with: npx jest tests/integration/full-flow --runInBand
 */

import { databaseService } from "@/lib/db";
import { stellarService } from "@/lib/stellar";
import { calculateAmounts } from "@/lib/config";

const SKIP =
  !process.env.DATABASE_URL ||
  !process.env.ESCROW_CONTRACT_ID ||
  !process.env.AGENT_SECRET_KEY;

const describeOrSkip = SKIP ? describe.skip : describe;

describeOrSkip("Full Remittance Flow Integration", () => {
  const txId = `flow-test-${Date.now()}`;
  const vndAmount = 250_000; // 250,000 VND = 10 USDC

  beforeAll(async () => {
    // Ensure agent has enough collateral
    const balance = await stellarService.getContractBalance();
    if (balance.available < 0.5) {
      await stellarService.fundContract(5);
    }
  }, 60_000);

  test("Step 1: create remittance — reserve USDC on-chain and persist to DB", async () => {
    const { usdcEquivalent, phpPayout } = calculateAmounts(vndAmount);

    const { txHash } = await stellarService.reserveCollateral(txId, usdcEquivalent);
    expect(txHash).toBeTruthy();

    const record = await databaseService.createRemittance({
      txId,
      vndAmount,
      usdcEquivalent,
      phpPayout,
      receiverName: "Integration Test Receiver",
      receiverAccount: "09999999999",
      stellarTxHash: txHash,
    });

    expect(record.txId).toBe(txId);
    expect(record.status).toBe("funded");
    expect(record.vndAmount).toBe(vndAmount);
  }, 60_000);

  test("Step 2: mark-paid — update status to processing", async () => {
    await databaseService.updateSenderProof(txId, "data:image/png;base64,fakeproof");
    await databaseService.updateStatus(txId, "processing");

    const record = await databaseService.getRemittance(txId);
    expect(record?.status).toBe("processing");
    expect(record?.senderProofRef).toBeTruthy();
  }, 15_000);

  test("Step 3: agent-proof — store agent proof", async () => {
    await databaseService.updateAgentProof(txId, "data:image/png;base64,agentproof");

    const record = await databaseService.getRemittance(txId);
    expect(record?.agentProofRef).toBeTruthy();
  }, 15_000);

  test("Step 4: confirm — release USDC on-chain and mark completed", async () => {
    const { txHash, releasedUsdc } = await stellarService.confirmPayout(txId);
    expect(txHash).toBeTruthy();
    expect(releasedUsdc).toBeGreaterThan(0);

    await databaseService.updateStatus(txId, "completed");
    await databaseService.updateStellarTxHash(txId, txHash);

    const record = await databaseService.getRemittance(txId);
    expect(record?.status).toBe("completed");
    expect(record?.stellarTxHash).toBe(txHash);
  }, 60_000);

  test("Verify: record appears in list", async () => {
    const list = await databaseService.listRemittances();
    const found = list.find((r) => r.txId === txId);
    expect(found).toBeDefined();
    expect(found?.status).toBe("completed");
  }, 15_000);

  test("No double-spend: second reserve with same txId should fail", async () => {
    const { usdcEquivalent } = calculateAmounts(vndAmount);
    await expect(
      stellarService.reserveCollateral(txId, usdcEquivalent)
    ).rejects.toThrow();
  }, 30_000);
});
