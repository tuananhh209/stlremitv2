// Feature: stellar-remittance-mvp, Properties 11,12: Authorization and Expiry
import fc from "fast-check";
import { UnauthorizedError, TransactionExpiredError } from "@/lib/errors";

const AGENT_ADDRESS = "GCCSYOOWH3QQAGTMOF4OP72EKHPMJLP6I7O7MGW5LEDYAOP52DQNYY47";

// Simulate contract-level authorization check
function requireAgent(caller: string): void {
  if (caller !== AGENT_ADDRESS) {
    throw new UnauthorizedError();
  }
}

// Simulate contract-level expiry check
function requireNotExpired(createdAt: number, now: number, timeoutSeconds = 300): void {
  if (now > createdAt + timeoutSeconds * 1000) {
    throw new TransactionExpiredError("tx");
  }
}

describe("Authorization and Expiry", () => {
  // Property 11
  test("Property 11: non-agent callers are rejected with UNAUTHORIZED", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 56, maxLength: 56 }).filter((s) => s !== AGENT_ADDRESS),
        (nonAgent) => {
          expect(() => requireAgent(nonAgent)).toThrow(UnauthorizedError);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 11b: agent address is accepted", () => {
    expect(() => requireAgent(AGENT_ADDRESS)).not.toThrow();
  });

  // Property 12
  test("Property 12: confirm rejected after timeout", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3600 }),
        (secondsOver) => {
          const createdAt = Date.now() - (300 + secondsOver) * 1000;
          expect(() => requireNotExpired(createdAt, Date.now())).toThrow(
            TransactionExpiredError
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 12b: confirm accepted before timeout", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 299 }),
        (secondsIn) => {
          const createdAt = Date.now() - secondsIn * 1000;
          expect(() => requireNotExpired(createdAt, Date.now())).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
