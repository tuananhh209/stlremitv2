import { NextRequest, NextResponse } from "next/server";
import { stellarBuilderService } from "@/lib/stellar-builder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { publicKey, usdcAmount } = await req.json();
    if (!publicKey || !usdcAmount) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const xdr = await stellarBuilderService.buildFundTx(publicKey, usdcAmount);
    return NextResponse.json({ xdr });
  } catch (error: any) {
    console.error("Build fund tx error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
