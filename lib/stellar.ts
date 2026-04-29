import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  rpc as StellarRpc,
  xdr,
} from "@stellar/stellar-sdk";
import { STELLAR_CONFIG } from "./stellar-config";
import {
  StellarTransactionError,
  InsufficientLiquidityError,
} from "./errors";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FundContractResult {
  txHash: string;
  newBalance: number;
}

export interface ReserveCollateralResult {
  txHash: string;
}

export interface ConfirmPayoutResult {
  txHash: string;
  releasedUsdc: number;
}

export interface RefundCollateralResult {
  txHash: string;
  refundedUsdc: number;
}

export interface ContractBalance {
  total: number;
  available: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// USDC uses 7 decimal places in Soroban (stroops-like)
const USDC_DECIMALS = 10_000_000; // 1 USDC = 10^7 units

function toContractAmount(usdc: number): bigint {
  return BigInt(Math.round(usdc * USDC_DECIMALS));
}

function fromContractAmount(raw: bigint | number): number {
  return Number(raw) / USDC_DECIMALS;
}

// ── StellarService ────────────────────────────────────────────────────────────

export class StellarService {
  private server: StellarRpc.Server;
  private agentKeypair: Keypair;
  private contractId: string;

  constructor() {
    this.server = new StellarRpc.Server(STELLAR_CONFIG.RPC_URL, {
      allowHttp: false,
    });
    this.agentKeypair = Keypair.fromSecret(STELLAR_CONFIG.AGENT_SECRET_KEY);
    this.contractId = STELLAR_CONFIG.ESCROW_CONTRACT_ID;
  }

  // ── Internal: invoke contract function ──────────────────────────────────

  private async invokeContract(
    functionName: string,
    args: xdr.ScVal[],
    memo?: string
  ): Promise<{ txHash: string; returnValue: xdr.ScVal }> {
    const agentAccount = await this.server.getAccount(
      this.agentKeypair.publicKey()
    );

    const contract = new (await import("@stellar/stellar-sdk")).Contract(
      this.contractId
    );

    let txBuilder = new TransactionBuilder(agentAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call(functionName, ...args))
      .setTimeout(30);

    if (memo) {
      txBuilder = txBuilder.addMemo(
        (await import("@stellar/stellar-sdk")).Memo.text(memo.slice(0, 28))
      );
    }

    const tx = txBuilder.build();

    // Simulate first
    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError(
        "SIMULATION_FAILED",
        undefined,
        simResult.error
      );
    }

    // Assemble and sign
    const assembled = StellarRpc.assembleTransaction(tx, simResult).build();
    assembled.sign(this.agentKeypair);

    // Submit
    const sendResult = await this.server.sendTransaction(assembled);
    if (sendResult.status === "ERROR") {
      throw new StellarTransactionError(
        sendResult.errorResult?.result().toString() ?? "SUBMIT_ERROR",
        sendResult.hash
      );
    }

    // Poll for confirmation
    const txHash = sendResult.hash;
    let getResult = await this.server.getTransaction(txHash);
    let attempts = 0;
    while (
      getResult.status === StellarRpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 20
    ) {
      await new Promise((r) => setTimeout(r, 1500));
      getResult = await this.server.getTransaction(txHash);
      attempts++;
    }

    if (getResult.status !== StellarRpc.Api.GetTransactionStatus.SUCCESS) {
      throw new StellarTransactionError(
        getResult.status,
        txHash,
        `Transaction ${txHash} failed with status: ${getResult.status}`
      );
    }

    const returnValue =
      getResult.returnValue ?? xdr.ScVal.scvVoid();

    return { txHash, returnValue };
  }

  // ── Public methods ────────────────────────────────────────────────────────

  /**
   * Agent deposits USDC into the escrow contract collateral pool.
   */
  async fundContract(usdcAmount: number): Promise<FundContractResult> {
    const amount = toContractAmount(usdcAmount);
    const args = [
      new Address(this.agentKeypair.publicKey()).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ];

    const { txHash, returnValue } = await this.invokeContract("fund", args);
    const newBalanceRaw = scValToNative(returnValue) as bigint;
    const newBalance = fromContractAmount(newBalanceRaw);

    return { txHash, newBalance };
  }

  /**
   * Reserve USDC for a remittance request. Attaches txId as memo.
   */
  async reserveCollateral(
    txId: string,
    usdcAmount: number
  ): Promise<ReserveCollateralResult> {
    // Check available balance first
    const balance = await this.getContractBalance();
    if (balance.available < usdcAmount) {
      throw new InsufficientLiquidityError(usdcAmount, balance.available);
    }

    const amount = toContractAmount(usdcAmount);
    const args = [
      nativeToScVal(txId, { type: "string" }),
      nativeToScVal(amount, { type: "i128" }),
      new Address(this.agentKeypair.publicKey()).toScVal(),
    ];

    const { txHash } = await this.invokeContract("reserve", args, txId);
    return { txHash };
  }

  /**
   * Agent confirms payout — releases reserved USDC back to pool.
   */
  async confirmPayout(txId: string): Promise<ConfirmPayoutResult> {
    const args = [
      nativeToScVal(txId, { type: "string" }),
      new Address(this.agentKeypair.publicKey()).toScVal(),
    ];

    const { txHash, returnValue } = await this.invokeContract(
      "confirm",
      args
    );
    const releasedRaw = scValToNative(returnValue) as bigint;
    const releasedUsdc = fromContractAmount(releasedRaw);

    return { txHash, releasedUsdc };
  }

  /**
   * Refund reserved USDC back to pool after timeout.
   */
  async refundCollateral(txId: string): Promise<RefundCollateralResult> {
    const args = [nativeToScVal(txId, { type: "string" })];

    const { txHash, returnValue } = await this.invokeContract(
      "refund",
      args
    );
    const refundedRaw = scValToNative(returnValue) as bigint;
    const refundedUsdc = fromContractAmount(refundedRaw);

    return { txHash, refundedUsdc };
  }

  /**
   * Query available collateral balance from contract.
   */
  async getContractBalance(): Promise<ContractBalance> {
    try {
      const agentAccount = await this.server.getAccount(
        this.agentKeypair.publicKey()
      );
      const contract = new (await import("@stellar/stellar-sdk")).Contract(
        this.contractId
      );

      const tx = new TransactionBuilder(agentAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(contract.call("get_balance"))
        .setTimeout(30)
        .build();

      const simResult = await this.server.simulateTransaction(tx);
      if (StellarRpc.Api.isSimulationError(simResult)) {
        // Contract not yet funded — return 0
        return { total: 0, available: 0 };
      }

      const returnValue = (simResult as StellarRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
      if (!returnValue) return { total: 0, available: 0 };

      const totalRaw = scValToNative(returnValue) as bigint;
      const total = fromContractAmount(totalRaw);

      return { total, available: total };
    } catch {
      return { total: 0, available: 0 };
    }
  }
}

// Singleton instance
export const stellarService = new StellarService();
