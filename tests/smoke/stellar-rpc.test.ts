/**
 * Smoke test: Stellar RPC connectivity and contract deployment verification.
 * Verifies that the Stellar testnet RPC is reachable and the escrow contract exists.
 */

import { rpc as StellarRpc } from "@stellar/stellar-sdk";
import { STELLAR_CONFIG } from "@/lib/stellar-config";
import { stellarService } from "@/lib/stellar";

const SKIP =
  !process.env.ESCROW_CONTRACT_ID || !process.env.AGENT_SECRET_KEY;

const describeOrSkip = SKIP ? describe.skip : describe;

describeOrSkip("Stellar RPC Smoke Test", () => {
  let server: StellarRpc.Server;

  beforeAll(() => {
    server = new StellarRpc.Server(STELLAR_CONFIG.RPC_URL, {
      allowHttp: false,
    });
  });

  test("Stellar testnet RPC is reachable", async () => {
    const health = await server.getHealth();
    expect(health.status).toBe("healthy");
  }, 15_000);

  test("Agent account exists on testnet", async () => {
    const account = await server.getAccount(STELLAR_CONFIG.AGENT_PUBLIC_KEY ?? STELLAR_CONFIG.AGENT_SECRET_KEY);
    expect(account).toBeTruthy();
    expect(account.accountId()).toBeTruthy();
  }, 15_000);

  test("Escrow contract is deployed and queryable", async () => {
    const balance = await stellarService.getContractBalance();
    // If contract is deployed, getContractBalance returns a valid object
    expect(typeof balance.total).toBe("number");
    expect(typeof balance.available).toBe("number");
    expect(balance.total).toBeGreaterThanOrEqual(0);
  }, 30_000);

  test("ESCROW_CONTRACT_ID is a valid Stellar contract address", () => {
    const contractId = STELLAR_CONFIG.ESCROW_CONTRACT_ID;
    // Stellar contract IDs start with 'C' and are 56 chars
    expect(contractId).toMatch(/^C[A-Z2-7]{55}$/);
  });
});
