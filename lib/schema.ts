import {
  pgTable,
  text,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const remittanceStatusEnum = pgEnum("remittance_status", [
  "pending_agent",
  "cancelled",
  "funded",
  "processing",
  "payout_submitted",
  "completed",
  "expired",
]);

export const remittanceRequests = pgTable("remittance_requests", {
  txId: text("tx_id").primaryKey(),
  vndAmount: numeric("vnd_amount", { precision: 20, scale: 2 }).notNull(),
  usdcEquivalent: numeric("usdc_equivalent", {
    precision: 20,
    scale: 7,
  }).notNull(),
  phpPayout: numeric("php_payout", { precision: 20, scale: 2 }).notNull(),
  receiverName: text("receiver_name").notNull(),
  receiverAccount: text("receiver_account").notNull(),
  status: remittanceStatusEnum("status").notNull().default("funded"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  senderProofRef: text("sender_proof_ref"),
  agentProofRef: text("agent_proof_ref"),
  stellarTxHash: text("stellar_tx_hash"),
  // Added via ALTER TABLE
  receiverWallet: text("receiver_wallet"),
  senderWallet: text("sender_wallet"),
  senderName: text("sender_name"),
  agentWallet: text("agent_wallet"),
});

export const agentState = pgTable("agent_state", {
  id: text("id").primaryKey().default("singleton"),
  totalCollateral: numeric("total_collateral", {
    precision: 20,
    scale: 7,
  })
    .notNull()
    .default("0"),
  reservedUsdc: numeric("reserved_usdc", { precision: 20, scale: 7 })
    .notNull()
    .default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── User Profiles ─────────────────────────────────────────────────────────────
// Keyed by wallet address. Stores bank/payout info for all roles.
export const userProfiles = pgTable("user_profiles", {
  walletAddress: text("wallet_address").primaryKey(),
  role: text("role").notNull(),
  // Bank / payout info
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountHolder: text("account_holder"),
  qrImageUrl: text("qr_image_url"),          // Cloudinary URL for QR code
  // Agent-specific
  agentBankName: text("agent_bank_name"),
  agentAccountNumber: text("agent_account_number"),
  agentAccountHolder: text("agent_account_holder"),
  agentQrImageUrl: text("agent_qr_image_url"), // Cloudinary URL for agent QR
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
