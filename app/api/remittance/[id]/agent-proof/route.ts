import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";
import type { AgentProofResponse } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;
    const body = await req.json();
    const { proofImageBase64, proofImageMimeType } = body;

    // Accept any image — no content validation
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
    const agentProofRef = `data:${mimeType};base64,${proofImageBase64.replace(/^data:[^;]+;base64,/, "")}`;

    await databaseService.updateAgentProof(txId, agentProofRef);

    const response: AgentProofResponse = { txId, agentProofRef };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
