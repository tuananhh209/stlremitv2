import {
  pgTable,
  text,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const remittanceStatusEnum = pgEnum("remittance_status", [
  "funded",
  "processing",
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
