// Feature: stellar-remittance-mvp, Properties 5,6,7,8,15,16: State Machine Transitions
import fc from "fast-check";
import {
  InvalidStatusTransitionError,
  TransactionExpiredError,
} from "@/lib/errors";
import type { RemittanceStatus } from "@/lib/types";

// Pure state machine logic (mirrors API route logic)
function markPaid(
  status: RemittanceStatus,
  expiresAt: Date,
  now: Date
): RemittanceStatus {
  if (status !== "funded") {
    throw new InvalidStatusTransitionError("tx", status, "mark-paid");
  }
  if (expiresAt <= now) {
    throw new TransactionExpiredError("tx");
  }
  return "processing";
}

function confirmPayout(status: RemittanceStatus): RemittanceStatus {
  if (status !== "processing") {
    throw new InvalidStatusTransitionError("tx", status, "confirm");
  }
  return "completed";
}

function refund(
  status: RemittanceStatus,
  expiresAt: Date,
  now: Date
): RemittanceStatus {
  if (status !== "funded") {
    // Guard: do NOT refund if processing or completed
    throw new InvalidStatusTransitionError("tx", status, "refund");
  }
  if (expiresAt > now) {
    throw new Error("Not expired yet");
  }
  return "expired";
}

function agentProof(status: RemittanceStatus): void {
  if (status !== "processing") {
    throw new InvalidStatusTransitionError("tx", status, "agent-proof");
  }
}

describe("State Machine Transitions", () => {
  // Property 5
  test("Property 5: funded → processing when mark-paid before expiry", () => {
    fc.assert(
      fc.property(fc.uuid(), (txId) => {
        const future = new Date(Date.now() + 300_000);
        const result = markPaid("funded", future, new Date());
        expect(result).toBe("processing");
      }),
      { numRuns: 100 }
    );
  });

  // Property 6
  test("Property 6: processing → completed on confirm", () => {
    fc.assert(
      fc.property(fc.uuid(), (_txId) => {
        const result = confirmPayout("processing");
        expect(result).toBe("completed");
      }),
      { numRuns: 100 }
    );
  });

  // Property 7
  test("Property 7: funded → expired on refund after timeout", () => {
    fc.assert(
      fc.property(fc.uuid(), (_txId) => {
        const past = new Date(Date.now() - 1000);
        const result = refund("funded", past, new Date());
        expect(result).toBe("expired");
      }),
      { numRuns: 100 }
    );
  });

  // Property 8
  test("Property 8: mark-paid rejected for non-funded status", () => {
    const nonFunded: RemittanceStatus[] = ["processing", "completed", "expired"];
    fc.assert(
      fc.property(
        fc.constantFrom(...nonFunded),
        (status) => {
          const future = new Date(Date.now() + 300_000);
          expect(() => markPaid(status, future, new Date())).toThrow(
            InvalidStatusTransitionError
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 8b: mark-paid rejected when expired", () => {
    fc.assert(
      fc.property(fc.uuid(), (_txId) => {
        const past = new Date(Date.now() - 1000);
        expect(() => markPaid("funded", past, new Date())).toThrow(
          TransactionExpiredError
        );
      }),
      { numRuns: 100 }
    );
  });

  // Property 15
  test("Property 15: agent-proof rejected for non-processing status", () => {
    const nonProcessing: RemittanceStatus[] = ["funded", "completed", "expired"];
    fc.assert(
      fc.property(
        fc.constantFrom(...nonProcessing),
        (status) => {
          expect(() => agentProof(status)).toThrow(InvalidStatusTransitionError);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 16
  test("Property 16: refund NOT called for processing or completed status", () => {
    const nonRefundable: RemittanceStatus[] = ["processing", "completed"];
    fc.assert(
      fc.property(
        fc.constantFrom(...nonRefundable),
        (status) => {
          const past = new Date(Date.now() - 1000);
          expect(() => refund(status, past, new Date())).toThrow(
            InvalidStatusTransitionError
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
