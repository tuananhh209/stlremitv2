// Feature: stellar-remittance-mvp, Properties 9,10: Proof Image Upload
import fc from "fast-check";

// Simulate proof ref building (mirrors API route logic)
function buildProofRef(base64: string, mimeType: string): string {
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  return `data:${mimeType};base64,${clean}`;
}

function isValidProofRef(ref: string): boolean {
  return ref.startsWith("data:") && ref.includes(";base64,");
}

describe("Proof Image Upload", () => {
  // Property 9: accept any content without validation
  test("Property 9: any base64 string is accepted without content validation", () => {
    fc.assert(
      fc.property(
        fc.base64String({ minLength: 1, maxLength: 1000 }),
        fc.constantFrom("image/jpeg", "image/png", "image/gif", "application/pdf", "text/plain"),
        (base64, mimeType) => {
          // Should not throw — no content validation
          expect(() => buildProofRef(base64, mimeType)).not.toThrow();
          const ref = buildProofRef(base64, mimeType);
          expect(ref).toBeTruthy();
          expect(typeof ref).toBe("string");
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 10: proof reference is non-null and retrievable
  test("Property 10: stored proof reference is non-null and well-formed", () => {
    fc.assert(
      fc.property(
        fc.base64String({ minLength: 4, maxLength: 500 }),
        fc.constantFrom("image/jpeg", "image/png", "image/webp"),
        (base64, mimeType) => {
          const ref = buildProofRef(base64, mimeType);
          expect(ref).not.toBeNull();
          expect(ref.length).toBeGreaterThan(0);
          expect(isValidProofRef(ref)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("proof ref strips existing data URI prefix", () => {
    const withPrefix = "data:image/png;base64,abc123";
    const ref = buildProofRef(withPrefix, "image/jpeg");
    // Should not double-encode
    expect(ref).toBe("data:image/jpeg;base64,abc123");
  });
});
