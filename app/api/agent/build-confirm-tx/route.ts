import { NextRequest, NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { publicKey, txId } = await req.json();
    if (!publicKey || !txId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const xdr = await stellarService.buildConfirmTx(publicKey, txId);
    return NextResponse.json({ xdr });
  } catch (error: any) {
    console.error("Build confirm tx error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
