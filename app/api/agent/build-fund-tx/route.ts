import { NextRequest, NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { publicKey, usdcAmount } = await req.json();
    if (!publicKey || !usdcAmount) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const xdr = await stellarService.buildFundTx(publicKey, usdcAmount);
    return NextResponse.json({ xdr });
  } catch (error: any) {
    console.error("Build fund tx error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
