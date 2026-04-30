import { NextRequest, NextResponse } from "next/server";
import { stellarService } from "@/lib/stellar";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { signedXdr } = await req.json();
    if (!signedXdr) {
      return NextResponse.json({ error: "Missing signedXdr" }, { status: 400 });
    }

    const txHash = await stellarService.submitTransaction(signedXdr);
    return NextResponse.json({ txHash });
  } catch (error: any) {
    console.error("Submit transaction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
