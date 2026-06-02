import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { databaseService } from "@/lib/db";
import { calculateAmounts } from "@/lib/config";
import { errorResponse } from "@/lib/api-helpers";
import { z } from "zod";

const CreateRemittanceSchema = z.object({
  vndAmount: z.number().positive("vndAmount must be a positive number"),
  receiverName: z.string().trim().min(1, "receiverName is required"),
  receiverAccount: z.string().trim().min(1, "receiverAccount is required"),
  receiverWallet: z.string().trim().min(1, "receiverWallet (Stellar address) is required"),
  senderWallet: z.string().trim().optional(),
  senderName: z.string().trim().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const result = CreateRemittanceSchema.safeParse(body);
    if (!result.success) {
      const errorMsg = result.error.errors[0].message;
      return NextResponse.json(
        { error: errorMsg, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    
    const { vndAmount, receiverName, receiverAccount, receiverWallet, senderWallet, senderName } = result.data;

    const { usdcEquivalent, phpPayout } = calculateAmounts(vndAmount);
    const txId = uuidv4();

    const record = await databaseService.createRemittance({
      txId,
      vndAmount,
      usdcEquivalent,
      phpPayout,
      receiverName,
      receiverAccount,
      receiverWallet,
      senderWallet: senderWallet || null,
      senderName: senderName || null,
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
