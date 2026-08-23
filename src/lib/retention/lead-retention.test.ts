import { describe, expect, it } from "vitest";
import { privateLeadBlobUrls, retainedBySignedContract } from "./lead-retention";

describe("lead retention safety", () => {
  it("returns only exact private Blob URLs referenced by the deleted lead", () => {
    expect(privateLeadBlobUrls("https://store.public.blob.vercel-storage.com/leads/one.jpg?token=x\nhttps://evil.test/leads/two.jpg\ninvalid\nhttps://store.public.blob.vercel-storage.com/leads/one.jpg")).toEqual(["https://store.public.blob.vercel-storage.com/leads/one.jpg"]);
  });
  it("recognizes a legal-retention refusal separately from an operational failure", () => {
    expect(retainedBySignedContract(new Error("A lead with a signed contract must be archived according to the retention policy, not deleted."))).toBe(true);
    expect(retainedBySignedContract(new Error("Database unavailable"))).toBe(false);
  });
});
