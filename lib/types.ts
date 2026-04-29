// ─── Core domain types ────────────────────────────────────────────────────────

export type RemittanceStatus = "funded" | "processing" | "completed" | "expired";

export interface RemittanceRecord {
  txId: string;
  vndAmount: number;
  usdcEquivalent: number;
  phpPayout: number;
  receiverName: string;
  receiverAccount: string;
  status: RemittanceStatus;
  createdAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  senderProofRef: string | null;
  agentProofRef: string | null;
  stellarTxHash: string | null;
}

export interface AgentBalance {
  totalCollateral: number;
  reservedUsdc: number;
  availableUsdc: number; // = totalCollateral - reservedUsdc
}

// ─── Remittance request/response interfaces ───────────────────────────────────

export interface CreateRemittanceRequest {
  vndAmount: number;
  receiverName: string;
  receiverAccount: string;
}

export interface CreateRemittanceResponse {
  txId: string;
  usdcEquivalent: number;
  phpPayout: number;
  status: "funded";
  expiresAt: string; // ISO timestamp
  stellarTxHash: string;
}

export interface MarkPaidRequest {
  proofImageBase64: string; // base64 encoded image
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

// ─── Agent fund/balance interfaces ───────────────────────────────────────────

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
}

// ─── API error response ───────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: string;
  code:
    | "INSUFFICIENT_LIQUIDITY"
    | "INVALID_STATUS"
    | "EXPIRED"
    | "UNAUTHORIZED"
    | "NOT_FOUND"
    | "STELLAR_ERROR"
    | "DB_ERROR";
  details?: Record<string, unknown>;
}
