import { NextRequest, NextResponse } from "next/server";
import { stellarRpcService } from "@/lib/stellar-rpc";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { signedXdr } = await req.json();
    if (!signedXdr) {
      return NextResponse.json({ error: "Missing signedXdr" }, { status: 400 });
    }

    const txHash = await stellarRpcService.submitTransaction(signedXdr);
    return NextResponse.json({ txHash });
  } catch (error: any) {
    console.error("Submit transaction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
