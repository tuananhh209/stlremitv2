import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { stellarService } from "@/lib/stellar";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";
import type { ConfirmResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;

    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);

    if (record.status !== "processing") {
      throw new InvalidStatusTransitionError(txId, record.status, "confirm");
    }

    // Call contract confirm — may throw EXPIRED or UNAUTHORIZED
    const { txHash, releasedUsdc } = await stellarService.confirmPayout(txId);

    // Update DB
    await databaseService.updateStatus(txId, "completed");
    await databaseService.updateStellarTxHash(txId, txHash);

    const response: ConfirmResponse = {
      txId,
      status: "completed",
      stellarTxHash: txHash,
      releasedUsdc,
    };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
