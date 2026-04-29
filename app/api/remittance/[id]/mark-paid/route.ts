import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import {
  NotFoundError,
  InvalidStatusTransitionError,
  TransactionExpiredError,
} from "@/lib/errors";
import type { MarkPaidResponse } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;
    const body = await req.json();
    const { proofImageBase64, proofImageMimeType } = body;

    // Accept any image — no content validation required
    if (!proofImageBase64 || typeof proofImageBase64 !== "string") {
      return NextResponse.json(
        { error: "proofImageBase64 is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);

    if (record.status !== "funded") {
      throw new InvalidStatusTransitionError(txId, record.status, "mark-paid");
    }

    // Check not expired
    if (new Date(record.expiresAt) <= new Date()) {
      throw new TransactionExpiredError(txId);
    }

    // Store proof reference (base64 data URI or just mime+data)
    const mimeType = proofImageMimeType ?? "image/jpeg";
    const proofRef = `data:${mimeType};base64,${proofImageBase64.replace(/^data:[^;]+;base64,/, "")}`;

    await databaseService.updateSenderProof(txId, proofRef);
    await databaseService.updateStatus(txId, "processing");

    const response: MarkPaidResponse = { txId, status: "processing" };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
