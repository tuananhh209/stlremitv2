import {
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  Contract,
  rpc as StellarRpc,
} from "@stellar/stellar-sdk";
import { STELLAR_CONFIG } from "./stellar-config";
import { StellarTransactionError } from "./errors";

const USDC_DECIMALS = 10_000_000;

function toContractAmount(usdc: number): bigint {
  return BigInt(Math.round(usdc * USDC_DECIMALS));
}

export class StellarBuilderService {
  private server: StellarRpc.Server;
  private contractId: string;

  constructor() {
    this.server = new StellarRpc.Server(STELLAR_CONFIG.RPC_URL, {
      allowHttp: false,
    });
    this.contractId = STELLAR_CONFIG.ESCROW_CONTRACT_ID;
  }

  async buildFundTx(publicKey: string, usdcAmount: number): Promise<string> {
    const amount = toContractAmount(usdcAmount);
    const account = await this.server.getAccount(publicKey);
    const escrowContract = new Contract(this.contractId);

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
}

export const stellarBuilderService = new StellarBuilderService();
