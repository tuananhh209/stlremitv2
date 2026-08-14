import { expect, test } from "@jest/globals";
import { validateImageDataUri } from "../lib/image-upload";

test("accepts supported images and rejects invalid or oversized payloads", () => {
  expect(validateImageDataUri("data:image/png;base64,YQ==")).toContain("image/png");
  expect(() => validateImageDataUri("data:text/html;base64,YQ==")).toThrow("Only PNG");
  expect(() => validateImageDataUri("data:image/png;base64,YWFh", 2)).toThrow("5 MB");
});
