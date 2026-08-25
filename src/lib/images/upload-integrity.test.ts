import { describe, expect, it } from "vitest";
import { uploadDigestMatches, uploadSha256 } from "./upload-integrity";

describe("worker photo integrity", () => {
  it("accepts only the exact complete upload", () => {
    const bytes = new TextEncoder().encode("complete-photo");
    expect(uploadDigestMatches(bytes, uploadSha256(bytes))).toBe(true);
    expect(uploadDigestMatches(new TextEncoder().encode("partial"), uploadSha256(bytes))).toBe(false);
    expect(uploadDigestMatches(bytes, null)).toBe(false);
  });
});
