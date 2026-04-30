import { eq, lt, and } from "drizzle-orm";
import { db } from "./db-client";
import { remittanceRequests, agentState } from "./schema";
import type { RemittanceRecord, RemittanceStatus } from "./types";
import { EXCHANGE_RATES } from "./config";

// ── Helpers ──────────────────────────────────────────────────────────────────

function rowToRecord(row: typeof remittanceRequests.$inferSelect): RemittanceRecord {
  return {
    txId: row.txId,
    vndAmount: Number(row.vndAmount),
    usdcEquivalent: Number(row.usdcEquivalent),
    phpPayout: Number(row.phpPayout),
    receiverName: row.receiverName,
    receiverAccount: row.receiverAccount,
    status: row.status as RemittanceStatus,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    senderProofRef: row.senderProofRef ?? null,
    agentProofRef: row.agentProofRef ?? null,
    stellarTxHash: row.stellarTxHash ?? null,
  };
}

// ── Create data type ──────────────────────────────────────────────────────────

export interface CreateRemittanceData {
  txId: string;
  vndAmount: number;
  usdcEquivalent: number;
  phpPayout: number;
  receiverName: string;
  receiverAccount: string;
  stellarTxHash?: string;
}

// ── Database Service ──────────────────────────────────────────────────────────

export const databaseService = {
  /**
   * Create a new remittance request with status pending_agent.
   * expiresAt is set to far future initially — reset when agent accepts.
   */
  async createRemittance(data: CreateRemittanceData & { status?: RemittanceStatus }): Promise<RemittanceRecord> {
    const now = new Date();
    // expiresAt placeholder — will be reset to now+300s when agent accepts
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h placeholder

    const [row] = await db
      .insert(remittanceRequests)
      .values({
        txId: data.txId,
        vndAmount: data.vndAmount.toString(),
        usdcEquivalent: data.usdcEquivalent.toString(),
        phpPayout: data.phpPayout.toString(),
        receiverName: data.receiverName,
        receiverAccount: data.receiverAccount,
        status: data.status || "pending_agent",
        createdAt: now,
        expiresAt,
        stellarTxHash: data.stellarTxHash ?? null,
      })
      .returning();

    return rowToRecord(row);
  },

  /**
   * Get a single remittance by txId.
   */
  async getRemittance(txId: string): Promise<RemittanceRecord | null> {
    const [row] = await db
      .select()
      .from(remittanceRequests)
      .where(eq(remittanceRequests.txId, txId))
      .limit(1);

    return row ? rowToRecord(row) : null;
  },

  /**
   * List all remittances, newest first.
   */
  async listRemittances(): Promise<RemittanceRecord[]> {
    const rows = await db
      .select()
      .from(remittanceRequests)
      .orderBy(remittanceRequests.createdAt);

    return rows.map(rowToRecord).reverse();
  },

  /**
   * Agent accepts a pending_agent request:
   * - Sets status to "funded"
   * - Resets expiresAt to now + 300s (5-min payment window starts NOW)
   * - Stores stellar tx hash from USDC lock
   */
  async acceptRemittance(txId: string, stellarTxHash: string): Promise<RemittanceRecord> {
    const expiresAt = new Date(Date.now() + EXCHANGE_RATES.TIMEOUT_SECONDS * 1000);
    const [row] = await db
      .update(remittanceRequests)
      .set({ status: "funded", expiresAt, stellarTxHash })
      .where(eq(remittanceRequests.txId, txId))
      .returning();
    return rowToRecord(row);
  },

  /**
   * Update status of a remittance.
   */
  async updateStatus(txId: string, status: RemittanceStatus): Promise<void> {
    await db
      .update(remittanceRequests)
      .set({ status })
      .where(eq(remittanceRequests.txId, txId));
  },

  /**
   * Store sender proof image reference.
   */
  async updateSenderProof(txId: string, proofRef: string): Promise<void> {
    await db
      .update(remittanceRequests)
      .set({ senderProofRef: proofRef })
      .where(eq(remittanceRequests.txId, txId));
  },

  /**
   * Store agent proof image reference.
   */
  async updateAgentProof(txId: string, proofRef: string): Promise<void> {
    await db
      .update(remittanceRequests)
      .set({ agentProofRef: proofRef })
      .where(eq(remittanceRequests.txId, txId));
  },

  /**
   * Store Stellar transaction hash.
   */
  async updateStellarTxHash(txId: string, txHash: string): Promise<void> {
    await db
      .update(remittanceRequests)
      .set({ stellarTxHash: txHash })
      .where(eq(remittanceRequests.txId, txId));
  },

  /**
   * Get all "funded" remittances whose 5-min window has expired (for cron refund job).
   */
  async getExpiredFundedRemittances(): Promise<RemittanceRecord[]> {
    const now = new Date();
    const rows = await db
      .select()
      .from(remittanceRequests)
      .where(
        and(
          eq(remittanceRequests.status, "funded"),
          lt(remittanceRequests.expiresAt, now)
        )
      );
    return rows.map(rowToRecord);
  },

  // ── Agent state helpers ────────────────────────────────────────────────────

  /**
   * Get or initialize agent state singleton.
   */
  async getAgentState(): Promise<{ totalCollateral: number; reservedUsdc: number }> {
    const [row] = await db
      .select()
      .from(agentState)
      .where(eq(agentState.id, "singleton"))
      .limit(1);

    if (!row) {
      const [newRow] = await db
        .insert(agentState)
        .values({ id: "singleton", totalCollateral: "0", reservedUsdc: "0" })
        .onConflictDoNothing()
        .returning();
      return {
        totalCollateral: Number(newRow?.totalCollateral ?? 0),
        reservedUsdc: Number(newRow?.reservedUsdc ?? 0),
      };
    }

    return {
      totalCollateral: Number(row.totalCollateral),
      reservedUsdc: Number(row.reservedUsdc),
    };
  },

  /**
   * Update agent collateral balance in DB.
   */
  async updateAgentCollateral(totalCollateral: number): Promise<void> {
    await db
      .insert(agentState)
      .values({ id: "singleton", totalCollateral: totalCollateral.toString(), reservedUsdc: "0" })
      .onConflictDoUpdate({
        target: agentState.id,
        set: {
          totalCollateral: totalCollateral.toString(),
          updatedAt: new Date(),
        },
      });
  },
};
