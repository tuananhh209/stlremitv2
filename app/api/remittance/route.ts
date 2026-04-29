import { NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import type { RemittanceListResponse } from "@/lib/types";

export async function GET() {
  try {
    const remittances = await databaseService.listRemittances();
    const response: RemittanceListResponse = { remittances };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
