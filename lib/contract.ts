import * as soroban from "./soroban";

// Secondary frontend integration check target mapping contract functions.
export const contractIntegration = {
  getContractBalance: soroban.getContractBalance,
  fundContract: soroban.fundContract,
  reserveCollateral: soroban.reserveCollateral,
  confirmPayout: soroban.confirmPayout,
  refundCollateral: soroban.refundCollateral,
  checkWalletConnection: soroban.checkWalletConnection,
};
