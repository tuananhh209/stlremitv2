import { NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import type { RemittanceListResponse } from "@/lib/types";

export const dynamic = "force-dynamic"; // never cache this route

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;
    const filters = {
      receiver: searchParams.get("receiver") || searchParams.get("wallet") || undefined,
      sender: searchParams.get("sender") || undefined,
      agent: searchParams.get("agent") || undefined,
    };
    
    const remittances = await databaseService.listRemittances(limit, filters);
    const response: RemittanceListResponse = { remittances };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
