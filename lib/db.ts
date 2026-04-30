import { eq, lt, and, desc, inArray, lte } from "drizzle-orm";
import { db } from "./db-client";
import { remittanceRequests, agentState, userProfiles } from "./schema";
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
    receiverWallet: row.receiverWallet ?? null,
    status: row.status as RemittanceStatus,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    senderProofRef: row.senderProofRef ?? null,
    agentProofRef: row.agentProofRef ?? null,
    stellarTxHash: row.stellarTxHash ?? null,
    senderWallet: row.senderWallet ?? null,
    senderName: row.senderName ?? null,
    agentWallet: row.agentWallet ?? null,
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
  receiverWallet?: string;
  senderWallet?: string;
  senderName?: string;
  agentWallet?: string;
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
        receiverWallet: data.receiverWallet ?? null,
        senderWallet: data.senderWallet ?? null,
        senderName: data.senderName ?? null,
        agentWallet: data.agentWallet ?? null,
        status: data.status || "pending_agent",
        createdAt: now,
        expiresAt,
        ...(data.stellarTxHash ? { stellarTxHash: data.stellarTxHash } : {}),
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
   * List remittances, newest first.
   */
  async listRemittances(limit?: number, filters?: { receiver?: string; sender?: string; agent?: string }): Promise<RemittanceRecord[]> {
    let query = db
      .select()
      .from(remittanceRequests);
    
    const conditions = [];
    if (filters?.receiver) conditions.push(eq(remittanceRequests.receiverWallet, filters.receiver));
    if (filters?.sender) conditions.push(eq(remittanceRequests.senderWallet, filters.sender));
    if (filters?.agent) conditions.push(eq(remittanceRequests.agentWallet, filters.agent));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(remittanceRequests.createdAt)) as any;

    if (limit) {
      query = query.limit(limit) as any;
    }

    const rows = await query;
    return rows.map(rowToRecord);
  },

  /**
   * Agent accepts a pending_agent request:
   * - Sets status to "funded"
   * - Resets expiresAt to now + 300s (5-min payment window starts NOW)
   * - Stores stellar tx hash from USDC lock
   */
  async acceptRemittance(txId: string, stellarTxHash: string, agentWallet: string): Promise<RemittanceRecord> {
    const expiresAt = new Date(Date.now() + EXCHANGE_RATES.TIMEOUT_SECONDS * 1000);
    const [row] = await db
      .update(remittanceRequests)
      .set({ 
        status: "funded", 
        expiresAt, 
        stellarTxHash,
        agentWallet 
      })
      .where(eq(remittanceRequests.txId, txId))
      .returning();
    return rowToRecord(row);
  },

  /**
   * Update status of a remittance.
   */
  async updateStatus(txId: string, status: RemittanceStatus, expiresAt?: Date): Promise<void> {
    await db
      .update(remittanceRequests)
      .set({ 
        status,
        ...(expiresAt ? { expiresAt } : {})
      })
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
  async getExpiredActiveRemittances(): Promise<RemittanceRecord[]> {
    const now = new Date();
    const rows = await db
      .select()
      .from(remittanceRequests)
      .where(
        and(
          inArray(remittanceRequests.status, ["funded", "processing"]),
          lte(remittanceRequests.expiresAt, now)
        )
      );
    return rows.map(rowToRecord);
  },

  /**
   * Get receiver's wallet address by their account number.
   * Used when agent accepts to pass receiver address to smart contract.
   */
  async getReceiverWallet(receiverAccount: string): Promise<string | null> {
    const [row] = await db
      .select({ walletAddress: userProfiles.walletAddress })
      .from(userProfiles)
      .where(eq(userProfiles.accountNumber, receiverAccount))
      .limit(1);
    return row?.walletAddress ?? null;
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

  /**
   * Calculate total USDC currently reserved (locked in contract for active remittances).
   * Statuses: funded, processing
   */
  async getReservedUsdc(): Promise<number> {
    const rows = await db
      .select({ usdc: remittanceRequests.usdcEquivalent })
      .from(remittanceRequests)
      .where(
        inArray(remittanceRequests.status, ["funded", "processing", "payout_submitted"])
      );
    
    return rows.reduce((sum, r) => sum + Number(r.usdc), 0);
  },

  /**
   * Get total historical volume (sum of all remittances ever created).
   */
  async getHistoricalVolume(): Promise<number> {
    const rows = await db
      .select({ usdc: remittanceRequests.usdcEquivalent })
      .from(remittanceRequests);
    
    return rows.reduce((sum, r) => sum + Number(r.usdc), 0);
  },
};
