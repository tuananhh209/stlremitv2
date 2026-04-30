import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import {
  NotFoundError,
  InvalidStatusTransitionError,
  TransactionExpiredError,
} from "@/lib/errors";
import type { MarkPaidResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;
    const body = await req.json();
    const { proofImageBase64, proofImageMimeType } = body;

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

    if (new Date(record.expiresAt) <= new Date()) {
      throw new TransactionExpiredError(txId);
    }

    // Upload proof image to Cloudinary — store URL instead of raw base64 in DB
    const mimeType = proofImageMimeType ?? "image/jpeg";
    const dataUri = proofImageBase64.startsWith("data:")
      ? proofImageBase64
      : `data:${mimeType};base64,${proofImageBase64}`;

    let proofRef: string;
    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        public_id: `stl-remit/proofs/sender_${txId}`,
        overwrite: true,
        resource_type: "image",
      });
      proofRef = result.secure_url;
    } catch (uploadErr) {
      // Fallback: store truncated reference if Cloudinary fails
      console.error("[mark-paid] Cloudinary upload failed:", uploadErr);
      proofRef = `proof:${txId}:${Date.now()}`;
    }

    await databaseService.updateSenderProof(txId, proofRef);
    
    // Set 5 mins for agent to payout PHP
    const agentExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await databaseService.updateStatus(txId, "processing", agentExpiry);

    const response: MarkPaidResponse = { txId, status: "processing" };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
