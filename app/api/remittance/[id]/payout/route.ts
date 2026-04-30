import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { NotFoundError, InvalidStatusTransitionError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/remittance/[id]/payout
 * Called by Agent after they have paid PHP to the Receiver.
 * Updates DB: status stays 'processing', sets agentProofRef.
 * 
 * Body: { agentProofRef: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;
    const body = await req.json().catch(() => ({}));
    const { agentProofRef } = body;

    if (!agentProofRef) {
      return NextResponse.json({ error: "Missing agentProofRef" }, { status: 400 });
    }

    const record = await databaseService.getRemittance(txId);
    if (!record) throw new NotFoundError(txId);

    // Can only payout if already processing (meaning agent received VND)
    if (record.status !== "processing") {
      throw new InvalidStatusTransitionError(txId, record.status, "payout");
    }

    // Update DB: status changes to 'payout_submitted'
    await databaseService.updateAgentProof(txId, agentProofRef);
    await databaseService.updateStatus(txId, "payout_submitted");
    
    return NextResponse.json({ txId, status: "payout_submitted", agentProofRef });
  } catch (err) {
    return errorResponse(err);
  }
}
