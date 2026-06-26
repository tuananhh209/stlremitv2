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
import { StellarTransactionError } from "./errors";
import { databaseService } from "./db";

const USDC_DECIMALS = 10_000_000;

export interface ContractBalance {
  total: number;
  available: number;
}

export class StellarService {
  private server: StellarRpc.Server;
  private _agentKeypair: Keypair | null = null;
  private contractId: string;

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

  private async submitAndPoll(tx: any): Promise<string> {
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
      throw new StellarTransactionError(
        getResult.status,
        txHash,
        `Transaction ${txHash} failed: ${getResult.status}`
      );
    }

    return txHash;
  }

  async getRawContractBalance(): Promise<number> {
    try {
      const agentAccount = await this.server.getAccount(this.agentKeypair.publicKey());
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
        return 0;
      }

      const successResult = simResult as StellarRpc.Api.SimulateTransactionSuccessResponse;
      const retval = successResult.result?.retval;
      if (!retval) return 0;

      const totalRaw = scValToNative(retval) as bigint;
      return Number(totalRaw) / USDC_DECIMALS;
    } catch {
      return 0;
    }
  }

  async getContractBalance(): Promise<ContractBalance> {
    const total = await this.getRawContractBalance();
    let reserved = 0;
    try {
      reserved = await databaseService.getReservedUsdc();
    } catch {
      reserved = 0;
    }
    return {
      total,
      available: Math.max(0, total - reserved),
    };
  }

  async fundContract(depositAmount: number): Promise<{ txHash: string; newBalance: number }> {
    const amount = BigInt(Math.round(depositAmount * USDC_DECIMALS));
    const agentPublicKey = this.agentKeypair.publicKey();
    const agentAccount = await this.server.getAccount(agentPublicKey);
    const usdcContract = new Contract(STELLAR_CONFIG.USDC_TOKEN_ID);

    const tx = new TransactionBuilder(agentAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        usdcContract.call(
          "transfer",
          new Address(agentPublicKey).toScVal(),
          new Address(this.contractId).toScVal(),
          nativeToScVal(amount, { type: "i128" })
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError("SIMULATION_FAILED", undefined, simResult.error);
    }

    const assembled = StellarRpc.assembleTransaction(tx, simResult).build();
    assembled.sign(this.agentKeypair);

    const txHash = await this.submitAndPoll(assembled);
    console.log("stellarService.fundContract successfully submitted. Hash:", txHash);
    const newBalance = await this.getRawContractBalance();

    return { txHash, newBalance };
  }

  async reserveCollateral(txId: string, usdcAmount: number): Promise<{ txHash: string }> {
    const amount = BigInt(Math.round(usdcAmount * USDC_DECIMALS));
    const agentPublicKey = this.agentKeypair.publicKey();
    const agentAccount = await this.server.getAccount(agentPublicKey);
    const escrowContract = new Contract(this.contractId);

    const tx = new TransactionBuilder(agentAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        escrowContract.call(
          "accept",
          new Address(agentPublicKey).toScVal(),
          nativeToScVal(txId, { type: "string" }),
          nativeToScVal(amount, { type: "i128" }),
          new Address(agentPublicKey).toScVal()
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError("SIMULATION_FAILED", undefined, simResult.error);
    }

    const assembled = StellarRpc.assembleTransaction(tx, simResult).build();
    assembled.sign(this.agentKeypair);

    const txHash = await this.submitAndPoll(assembled);
    console.log("stellarService.reserveCollateral successfully submitted. Hash:", txHash);
    return { txHash };
  }

  async confirmPayout(txId: string): Promise<{ txHash: string; releasedUsdc: number }> {
    const agentPublicKey = this.agentKeypair.publicKey();
    const agentAccount = await this.server.getAccount(agentPublicKey);
    const escrowContract = new Contract(this.contractId);

    const tx = new TransactionBuilder(agentAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        escrowContract.call(
          "receiver_confirm",
          nativeToScVal(txId, { type: "string" }),
          new Address(agentPublicKey).toScVal()
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError("SIMULATION_FAILED", undefined, simResult.error);
    }

    const assembled = StellarRpc.assembleTransaction(tx, simResult).build();
    assembled.sign(this.agentKeypair);

    const txHash = await this.submitAndPoll(assembled);
    console.log("stellarService.confirmPayout successfully submitted. Hash:", txHash);

    let releasedUsdc = 0;
    try {
      const recordTx = new TransactionBuilder(agentAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(escrowContract.call("get_tx_record", nativeToScVal(txId, { type: "string" })))
        .setTimeout(30)
        .build();
      const simRecord = await this.server.simulateTransaction(recordTx);
      if (!StellarRpc.Api.isSimulationError(simRecord) && simRecord.result?.retval) {
        const val = scValToNative(simRecord.result.retval);
        if (val && typeof val === "object" && "amount" in val) {
          releasedUsdc = Number((val as any).amount) / USDC_DECIMALS;
        }
      }
    } catch {}

    return { txHash, releasedUsdc };
  }

  async refundCollateral(txId: string): Promise<{ txHash: string; refundedUsdc: number }> {
    const agentPublicKey = this.agentKeypair.publicKey();
    const agentAccount = await this.server.getAccount(agentPublicKey);
    const escrowContract = new Contract(this.contractId);

    const tx = new TransactionBuilder(agentAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        escrowContract.call(
          "refund",
          nativeToScVal(txId, { type: "string" })
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new StellarTransactionError("SIMULATION_FAILED", undefined, simResult.error);
    }

    const assembled = StellarRpc.assembleTransaction(tx, simResult).build();
    assembled.sign(this.agentKeypair);

    const txHash = await this.submitAndPoll(assembled);

    let refundedUsdc = 0;
    try {
      const recordTx = new TransactionBuilder(agentAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(escrowContract.call("get_tx_record", nativeToScVal(txId, { type: "string" })))
        .setTimeout(30)
        .build();
      const simRecord = await this.server.simulateTransaction(recordTx);
      if (!StellarRpc.Api.isSimulationError(simRecord) && simRecord.result?.retval) {
        const val = scValToNative(simRecord.result.retval);
        if (val && typeof val === "object" && "amount" in val) {
          refundedUsdc = Number((val as any).amount) / USDC_DECIMALS;
        }
      }
    } catch {}

    return { txHash, refundedUsdc };
  }
}

export const stellarService = new StellarService();
