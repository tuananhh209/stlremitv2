import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-client";
import { userProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api-helpers";

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

// PUT /api/profile  — upsert
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      walletAddress, role,
      bankName, accountNumber, accountHolder, qrImageUrl,
      agentBankName, agentAccountNumber, agentAccountHolder, agentQrImageUrl,
    } = body;

    if (!walletAddress || !role) {
      return NextResponse.json({ error: "walletAddress and role required", code: "VALIDATION_ERROR" }, { status: 400 });
    }

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
