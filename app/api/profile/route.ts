import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-client";
import { userProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api-helpers";
import { verifyProfileSignature } from "@/lib/profile-auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

// GET /api/profile?wallet=GXXX
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json({ error: "wallet param required", code: "VALIDATION_ERROR" }, { status: 400 });
    }
    const [row] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.walletAddress, wallet))
      .limit(1);

    return NextResponse.json(row ?? null);
  } catch (err) {
    return errorResponse(err);
  }
}

import { z } from "zod";

const profileSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address is required"),
  role: z.enum(["sender", "receiver", "agent"]),
  bankName: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
  qrImageUrl: z.string().nullable().optional(),
  agentBankName: z.string().nullable().optional(),
  agentAccountNumber: z.string().nullable().optional(),
  agentAccountHolder: z.string().nullable().optional(),
  agentQrImageUrl: z.string().nullable().optional(),
});

// PUT /api/profile  — upsert
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format(), code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const timestamp = req.headers.get("x-wallet-timestamp") ?? "";
    const signature = req.headers.get("x-wallet-signature") ?? "";
    if (!verifyProfileSignature(parsed.data, timestamp, signature)) {
      return NextResponse.json(
        { error: "Valid wallet signature required", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    if (parsed.data.role === "agent" && parsed.data.walletAddress !== env.AGENT_PUBLIC_KEY) {
      return NextResponse.json({ error: "Agent wallet is not authorized", code: "UNAUTHORIZED" }, { status: 403 });
    }
    
    const {
      walletAddress, role,
      bankName, accountNumber, accountHolder, qrImageUrl,
      agentBankName, agentAccountNumber, agentAccountHolder, agentQrImageUrl,
    } = parsed.data;

    const [row] = await db
      .insert(userProfiles)
      .values({
        walletAddress,
        role,
        bankName: bankName ?? null,
        accountNumber: accountNumber ?? null,
        accountHolder: accountHolder ?? null,
        qrImageUrl: qrImageUrl ?? null,
        agentBankName: agentBankName ?? null,
        agentAccountNumber: agentAccountNumber ?? null,
        agentAccountHolder: agentAccountHolder ?? null,
        agentQrImageUrl: agentQrImageUrl ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.walletAddress,
        set: {
          role,
          bankName: bankName ?? null,
          accountNumber: accountNumber ?? null,
          accountHolder: accountHolder ?? null,
          qrImageUrl: qrImageUrl ?? null,
          agentBankName: agentBankName ?? null,
          agentAccountNumber: agentAccountNumber ?? null,
          agentAccountHolder: agentAccountHolder ?? null,
          agentQrImageUrl: agentQrImageUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json(row);
  } catch (err) {
    return errorResponse(err);
  }
}
