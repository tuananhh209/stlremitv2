import {
  Keypair,
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
import { StellarTransactionError } from "./errors";

export interface RefundCollateralResult {
  txHash: string;
  refundedUsdc: number;
}

export interface ContractBalance {
  total: number;
  available: number;
}

const USDC_DECIMALS = 10_000_000;

function toContractAmount(usdc: number): bigint {
  return BigInt(Math.round(usdc * USDC_DECIMALS));
}

function fromContractAmount(raw: bigint | number): number {
  return Number(raw) / USDC_DECIMALS;
}

export class StellarRpcService {
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

  private get agentKeypair(): Keypair {
    if (!this._agentKeypair) {
      this._agentKeypair = Keypair.fromSecret(STELLAR_CONFIG.AGENT_SECRET_KEY);
    }
    return this._agentKeypair;
  }

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
      networkPassphrase: STELLAR_CONFIG.NETWORK_PASSPHRASE,
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
        networkPassphrase: STELLAR_CONFIG.NETWORK_PASSPHRASE,
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

  async refundCollateral(txId: string): Promise<RefundCollateralResult> {
    const args = [nativeToScVal(txId, { type: "string" })];

    const { txHash, returnValue } = await this.invokeContract("refund", args);
    const refundedRaw = scValToNative(returnValue) as bigint;
    const refundedUsdc = fromContractAmount(refundedRaw);
    return { txHash, refundedUsdc };
  }

  async submitTransaction(signedXdr: string): Promise<string> {
    const tx = TransactionBuilder.fromXDR(signedXdr, STELLAR_CONFIG.NETWORK_PASSPHRASE);
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

export const stellarRpcService = new StellarRpcService();
