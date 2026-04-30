import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;
    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);
    return NextResponse.json(record);
  } catch (err) {
    return errorResponse(err);
  }
}
