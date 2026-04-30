import { NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import type { RemittanceListResponse } from "@/lib/types";

export const dynamic = "force-dynamic"; // never cache this route

export async function GET() {
  try {
    const remittances = await databaseService.listRemittances();
    const response: RemittanceListResponse = { remittances };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
