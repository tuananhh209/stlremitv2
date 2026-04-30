import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { databaseService } from "@/lib/db";
import { calculateAmounts } from "@/lib/config";
import { errorResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vndAmount, receiverName, receiverAccount, receiverWallet, senderWallet, senderName } = body;

    if (!vndAmount || typeof vndAmount !== "number" || vndAmount <= 0) {
      return NextResponse.json(
        { error: "vndAmount must be a positive number", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    if (!receiverName || typeof receiverName !== "string" || !receiverName.trim()) {
      return NextResponse.json(
        { error: "receiverName is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    if (!receiverAccount || typeof receiverAccount !== "string" || !receiverAccount.trim()) {
      return NextResponse.json(
        { error: "receiverAccount is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    if (!receiverWallet || typeof receiverWallet !== "string" || !receiverWallet.trim()) {
      return NextResponse.json(
        { error: "receiverWallet (Stellar address) is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    const { usdcEquivalent, phpPayout } = calculateAmounts(vndAmount);
    const txId = uuidv4();

    const record = await databaseService.createRemittance({
      txId,
      vndAmount,
      usdcEquivalent,
      phpPayout,
      receiverName: receiverName.trim(),
      receiverAccount: receiverAccount.trim(),
      receiverWallet: receiverWallet.trim(),
      senderWallet: senderWallet?.trim() || null,
      senderName: senderName?.trim() || null,
      status: "pending_agent",
    });

    return NextResponse.json({
      txId: record.txId,
      usdcEquivalent: record.usdcEquivalent,
      phpPayout: record.phpPayout,
      status: record.status,
      expiresAt: record.expiresAt,
    }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
