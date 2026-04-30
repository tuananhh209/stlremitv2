// Core types for Stellar Remittance MVP

export type RemittanceStatus =
  | "pending_agent"    // Sender submitted, waiting for agent to accept & lock USDC
  | "cancelled"        // Sender cancelled before agent accepted
  | "funded"           // Agent accepted & locked USDC, waiting for sender to pay VND (5-min timer starts)
  | "processing"       // Sender uploaded VND proof, agent needs to pay PHP
  | "payout_submitted" // Agent uploaded PHP proof, waiting for receiver to confirm
  | "completed"        // Agent confirmed PHP payout on-chain, USDC released
  | "expired";         // 5-min timer expired without sender paying, USDC unlocked

export interface RemittanceRecord {
  txId: string;
  vndAmount: number;
  usdcEquivalent: number;
  phpPayout: number;
  receiverName: string;
  receiverAccount: string;
  receiverWallet: string | null;   // Stellar wallet of receiver
  status: RemittanceStatus;
  createdAt: string;
  expiresAt: string;
  senderProofRef: string | null;
  agentProofRef: string | null;
  stellarTxHash: string | null;
  senderWallet: string | null;
  senderName: string | null;
  agentWallet: string | null;
}

export interface AgentBalance {
  totalCollateral: number;
  reservedUsdc: number;
  availableUsdc: number; // = totalCollateral - reservedUsdc
}

// --- Request / Response interfaces ---

export interface CreateRemittanceRequest {
  vndAmount: number;
  receiverName: string;
  receiverAccount: string;
  receiverWallet?: string;   // optional Stellar wallet of receiver
}

export interface CreateRemittanceResponse {
  txId: string;
  usdcEquivalent: number;
  phpPayout: number;
  status: "funded";
  expiresAt: string;
  stellarTxHash: string;
}

export interface MarkPaidRequest {
  proofImageBase64: string;
  proofImageMimeType: string;
}

export interface MarkPaidResponse {
  txId: string;
  status: "processing";
}

export interface AgentProofRequest {
  proofImageBase64: string;
  proofImageMimeType: string;
}

export interface AgentProofResponse {
  txId: string;
  agentProofRef: string;
}

export interface ConfirmResponse {
  txId: string;
  status: "completed";
  stellarTxHash: string;
  releasedUsdc: number;
}

export interface RemittanceListResponse {
  remittances: RemittanceRecord[];
}

export interface AgentFundRequest {
  usdcAmount: number;
}

export interface AgentFundResponse {
  newBalance: number;
  stellarTxHash: string;
}

export interface AgentBalanceResponse {
  totalCollateral: number;
  reservedUsdc: number;
  availableUsdc: number;
  historicalVolume: number;
}

export interface ApiErrorResponse {
  error: string;
  code:
    | "INSUFFICIENT_LIQUIDITY"
    | "INVALID_STATUS"
    | "EXPIRED"
    | "UNAUTHORIZED"
    | "NOT_FOUND"
    | "STELLAR_ERROR"
    | "DB_ERROR"
    | "VALIDATION_ERROR";
  details?: Record<string, unknown>;
}
