/**
 * Integration tests for Soroban Escrow Contract on Stellar testnet.
 *
 * These tests call the REAL testnet contract — requires:
 *   - ESCROW_CONTRACT_ID in env
 *   - AGENT_SECRET_KEY in env
 *
 * Run with: npx jest tests/integration/stellar-contract --runInBand
 *
 * NOTE: Each test advances ledger state on testnet. Run sequentially (--runInBand).
 */

import { stellarService } from "@/lib/stellar";

// Skip if env vars not set (CI without secrets)
const SKIP = !process.env.ESCROW_CONTRACT_ID || !process.env.AGENT_SECRET_KEY;

const describeOrSkip = SKIP ? describe.skip : describe;

describeOrSkip("Stellar Contract Integration", () => {
  const TEST_TX_ID = `integration-test-${Date.now()}`;

  test("1. getContractBalance returns a valid balance object", async () => {
    const balance = await stellarService.getContractBalance();
    expect(typeof balance.total).toBe("number");
    expect(typeof balance.available).toBe("number");
    expect(balance.total).toBeGreaterThanOrEqual(0);
    expect(balance.available).toBeGreaterThanOrEqual(0);
  }, 30_000);

  test("2. fundContract deposits USDC and increases balance", async () => {
    const before = await stellarService.getContractBalance();
    const depositAmount = 1; // 1 USDC

    const { txHash, newBalance } = await stellarService.fundContract(depositAmount);

    expect(txHash).toBeTruthy();
    expect(typeof txHash).toBe("string");
    expect(newBalance).toBeGreaterThanOrEqual(before.total + depositAmount - 0.001);
  }, 60_000);

  test("3. reserveCollateral deducts from available balance", async () => {
    const before = await stellarService.getContractBalance();

    // Only run if there's enough balance
    if (before.available < 0.5) {
      console.warn("Skipping reserve test — insufficient balance");
      return;
    }

    const reserveAmount = 0.1;
    const { txHash } = await stellarService.reserveCollateral(TEST_TX_ID, reserveAmount);

    expect(txHash).toBeTruthy();

    const after = await stellarService.getContractBalance();
    // Available should have decreased by approximately reserveAmount
    expect(after.available).toBeLessThan(before.available);
  }, 60_000);

  test("4. confirmPayout releases reserved USDC back to pool", async () => {
    const before = await stellarService.getContractBalance();

    const { txHash, releasedUsdc } = await stellarService.confirmPayout(TEST_TX_ID);

    expect(txHash).toBeTruthy();
    expect(releasedUsdc).toBeGreaterThan(0);

    const after = await stellarService.getContractBalance();
    expect(after.available).toBeGreaterThanOrEqual(before.available);
  }, 60_000);
});
