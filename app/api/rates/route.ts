import { NextResponse } from "next/server";
import { getLiveRates } from "@/lib/oracle";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getLiveRates();
  const ageSeconds = Math.round(
    (Date.now() - new Date(result.updatedAt).getTime()) / 1000
  );
  return NextResponse.json({ ...result, ageSeconds });
}
