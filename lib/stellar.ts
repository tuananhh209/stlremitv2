import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  Contract,
  Memo,
  rpc as StellarRpc,
  xdr,
} from "@stellar/stellar-sdk";
import { STELLAR_CONFIG } from "./stellar-config";
import { StellarTransactionError, InsufficientLiquidityError } from "./errors";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const USDC_DECIMALS = 10_000_000;

function toContractAmount(usdc: number): bigint {
  return BigInt(Math.round(usdc * USDC_DECIMALS));
}

function fromContractAmount(raw: bigint | number): number {
  return Number(raw) / USDC_DECIMALS;
}

// ── StellarService ────────────────────────────────────────────────────────────

export class StellarService {
  private server: StellarRpc.Server;
  private _agentKeypair: Keypair | null = null;
  private contractId: string;
  private balanceCache: ContractBalance | null = null;
  private balanceCacheTime: number = 0;

  constructor() {
    this.server = new StellarRpc.Server(STELLAR_CONFIG.RPC_URL, {
      allowHttp: false,
    });
    this.contractId = STELLAR_CONFIG.ESCROW_CONTRACT_ID;
  }

  /** Lazy-init keypair so build-time dummy env vars don't crash checksum validation */
  private get agentKeypair(): Keypair {
    if (!this._agentKeypair) {
      this._agentKeypair = Keypair.fromSecret(STELLAR_CONFIG.AGENT_SECRET_KEY);
    }
    return this._agentKeypair;
  }

  // ── Internal: build, simulate, sign, submit ───────────────────────────────

  private async invokeContract(
    functionName: string,
    args: xdr.ScVal[],
    memo?: string
  ): Promise<{ txHash: string; returnValue: xdr.ScVal }> {
    const agentAccount = await this.server.getAccount(
      this.agentKeypair.publicKey()
    );

    const contract = new Contract(this.contractId);

    let txBuilder = new TransactionBuilder(agentAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call(functionName, ...args))
      .setTimeout(30);

    if (memo) {
      txBuilder = txBuilder.addMemo(Memo.text(memo.slice(0, 28)));
    }

    const tx = txBuilder.build();

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError(
        "SIMULATION_FAILED",
        undefined,
        simResult.error
      );
    }

    const assembled = StellarRpc.assembleTransaction(tx, simResult).build();
    assembled.sign(this.agentKeypair);

    const sendResult = await this.server.sendTransaction(assembled);
    if (sendResult.status === "ERROR") {
      throw new StellarTransactionError(
        sendResult.errorResult?.result().toString() ?? "SUBMIT_ERROR",
        sendResult.hash
      );
    }

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
        `Transaction ${txHash} failed: ${getResult.status}`
      );
    }

    const returnValue = getResult.returnValue ?? xdr.ScVal.scvVoid();
    return { txHash, returnValue };
  }

  // ── Server-side contract calls ────────────────────────────────────────────

  async getContractBalance(): Promise<ContractBalance> {
    const now = Date.now();
    if (this.balanceCache && now - this.balanceCacheTime < 5000) {
      return this.balanceCache;
    }

    try {
      const agentAccount = await this.server.getAccount(
        this.agentKeypair.publicKey()
      );
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(agentAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(contract.call("get_balance"))
        .setTimeout(30)
        .build();

      const simResult = await this.server.simulateTransaction(tx);
      if (StellarRpc.Api.isSimulationError(simResult)) {
        return { total: 0, available: 0 };
      }

      const successResult =
        simResult as StellarRpc.Api.SimulateTransactionSuccessResponse;
      const retval = successResult.result?.retval;
      if (!retval) return { total: 0, available: 0 };

      const totalRaw = scValToNative(retval) as bigint;
      const total = fromContractAmount(totalRaw);
      
      const result = { total, available: total };
      this.balanceCache = result;
      this.balanceCacheTime = now;
      return result;
    } catch {
      return { total: 0, available: 0 };
    }
  }

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

  async reserveCollateral(
    txId: string,
    usdcAmount: number,
    receiverWallet?: string,
  ): Promise<ReserveCollateralResult> {
    const amount = toContractAmount(usdcAmount);
    const receiver = receiverWallet ?? this.agentKeypair.publicKey(); // fallback
    const args = [
      new Address(this.agentKeypair.publicKey()).toScVal(),
      nativeToScVal(txId, { type: "string" }),
      nativeToScVal(amount, { type: "i128" }),
      new Address(receiver).toScVal(),
    ];
    const { txHash } = await this.invokeContract("accept", args, txId);
    return { txHash };
  }

  async confirmPayout(txId: string): Promise<ConfirmPayoutResult> {
    // Legacy: server-side confirm (not used in new flow — receiver signs directly)
    const args = [
      nativeToScVal(txId, { type: "string" }),
      new Address(this.agentKeypair.publicKey()).toScVal(),
    ];
    const { txHash, returnValue } = await this.invokeContract("receiver_confirm", args);
    const releasedRaw = scValToNative(returnValue) as bigint;
    const releasedUsdc = fromContractAmount(releasedRaw);
    return { txHash, releasedUsdc };
  }

  async refundCollateral(txId: string): Promise<RefundCollateralResult> {
    const args = [nativeToScVal(txId, { type: "string" })];

    const { txHash, returnValue } = await this.invokeContract("refund", args);
    const refundedRaw = scValToNative(returnValue) as bigint;
    const refundedUsdc = fromContractAmount(refundedRaw);
    return { txHash, refundedUsdc };
  }

  // ── Client-side helpers (wallet-signed transactions) ──────────────────────

  async buildFundTx(publicKey: string, usdcAmount: number): Promise<string> {
    const amount = toContractAmount(usdcAmount);
    const account = await this.server.getAccount(publicKey);
    const escrowContract = new Contract(this.contractId);

    // Single operation: fund(agent, amount)
    // Soroban captures nested token.transfer auth from agent.require_auth()
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        escrowContract.call(
          "fund",
          new Address(publicKey).toScVal(),
          nativeToScVal(amount, { type: "i128" }),
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError("SIMULATION_FAILED", undefined, simResult.error);
    }
    return StellarRpc.assembleTransaction(tx, simResult).build().toXDR();
  }

  /**
   * Build accept tx: agent locks USDC for a specific remittance request.
   * accept(agent, tx_id, amount, receiver)
   * Single op — agent signs once, USDC locked atomically.
   */
  async buildAcceptTx(
    agentPublicKey: string,
    txId: string,
    usdcAmount: number,
    receiverWallet: string,
  ): Promise<string> {
    const amount = toContractAmount(usdcAmount);
    const account = await this.server.getAccount(agentPublicKey);
    const contract = new Contract(this.contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "accept",
          new Address(agentPublicKey).toScVal(),
          nativeToScVal(txId, { type: "string" }),
          nativeToScVal(amount, { type: "i128" }),
          new Address(receiverWallet).toScVal(),
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError("SIMULATION_FAILED", undefined, simResult.error);
    }
    return StellarRpc.assembleTransaction(tx, simResult).build().toXDR();
  }

  /**
   * Build receiver_confirm tx: receiver signs to confirm PHP received → releases USDC to agent.
   */
  async buildReceiverConfirmTx(
    receiverPublicKey: string,
    txId: string,
  ): Promise<string> {
    const account = await this.server.getAccount(receiverPublicKey);
    const contract = new Contract(this.contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "receiver_confirm",
          nativeToScVal(txId, { type: "string" }),
          new Address(receiverPublicKey).toScVal(),
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError("SIMULATION_FAILED", undefined, simResult.error);
    }
    return StellarRpc.assembleTransaction(tx, simResult).build().toXDR();
  }

  async buildConfirmTx(publicKey: string, txId: string): Promise<string> {
    const args = [
      nativeToScVal(txId, { type: "string" }),
      new Address(publicKey).toScVal(),
    ];

    const account = await this.server.getAccount(publicKey);
    const contract = new Contract(this.contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call("confirm", ...args))
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError(
        "SIMULATION_FAILED",
        undefined,
        simResult.error
      );
    }

    return StellarRpc.assembleTransaction(tx, simResult).build().toXDR();
  }

  async submitTransaction(signedXdr: string): Promise<string> {
    const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    const sendResult = await this.server.sendTransaction(tx);

    if (sendResult.status === "ERROR") {
      throw new StellarTransactionError(
        sendResult.errorResult?.result().toString() ?? "SUBMIT_ERROR",
        sendResult.hash
      );
    }

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
      throw new StellarTransactionError(getResult.status, txHash);
    }

    return txHash;
  }
}

// Singleton
export const stellarService = new StellarService();
