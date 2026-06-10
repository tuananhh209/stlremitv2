import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { databaseService } from "@/lib/db";
import { calculateAmounts } from "@/lib/config";
import type { CurrencyCode } from "@/lib/config";
import { getLiveRates } from "@/lib/oracle";
import { errorResponse } from "@/lib/api-helpers";
import { z } from "zod";

const VALID_CURRENCIES: CurrencyCode[] = ["PHP", "USD", "CNY", "RUB", "GBP", "EUR"];

const CreateRemittanceSchema = z.object({
  vndAmount: z.number().positive("vndAmount must be a positive number"),
  receiverName: z.string().trim().min(1, "receiverName is required"),
  receiverAccount: z.string().trim().min(1, "receiverAccount is required"),
  receiverWallet: z.string().trim().min(1, "receiverWallet (Stellar address) is required"),
  destinationCurrency: z.string().refine(v => VALID_CURRENCIES.includes(v as CurrencyCode), {
    message: "destinationCurrency must be one of: PHP, USD, CNY, RUB, GBP, EUR",
  }).default("PHP"),
  senderWallet: z.string().trim().optional(),
  senderName: z.string().trim().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = CreateRemittanceSchema.safeParse(body);
    if (!result.success) {
      const errorMsg = result.error.issues[0].message;
      return NextResponse.json(
        { error: errorMsg, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { vndAmount, receiverName, receiverAccount, receiverWallet, destinationCurrency, senderWallet, senderName } = result.data;

    // Use live oracle rates for accurate payout calculation
    const oracle = await getLiveRates();
    const { usdcEquivalent, phpPayout } = calculateAmounts(
      vndAmount,
      destinationCurrency as CurrencyCode,
      oracle.rates
    );

    const txId = uuidv4();

    const record = await databaseService.createRemittance({
      txId,
      vndAmount,
      usdcEquivalent,
      phpPayout,
      destinationCurrency,
      receiverName,
      receiverAccount,
      receiverWallet,
      senderWallet: senderWallet || undefined,
      senderName: senderName || undefined,
      status: "pending_agent",
    });

    return NextResponse.json({
      txId: record.txId,
      usdcEquivalent: record.usdcEquivalent,
      phpPayout: record.phpPayout,
      destinationCurrency: record.destinationCurrency,
      rateSource: oracle.source,
      status: record.status,
      expiresAt: record.expiresAt,
    }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
