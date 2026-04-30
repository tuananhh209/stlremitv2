import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";
import type { AgentProofResponse } from "@/lib/types";

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

    if (record.status !== "processing") {
      throw new InvalidStatusTransitionError(txId, record.status, "agent-proof");
    }

    const mimeType = proofImageMimeType ?? "image/jpeg";
    const dataUri = proofImageBase64.startsWith("data:")
      ? proofImageBase64
      : `data:${mimeType};base64,${proofImageBase64}`;

    let agentProofRef: string;
    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        public_id: `stl-remit/proofs/agent_${txId}`,
        overwrite: true,
        resource_type: "image",
      });
      agentProofRef = result.secure_url;
    } catch (uploadErr) {
      console.error("[agent-proof] Cloudinary upload failed:", uploadErr);
      agentProofRef = `proof:agent:${txId}:${Date.now()}`;
    }

    await databaseService.updateAgentProof(txId, agentProofRef);

    const response: AgentProofResponse = { txId, agentProofRef };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
