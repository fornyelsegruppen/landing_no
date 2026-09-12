import { describe, expect, it } from "vitest";
import { postRevision } from "./post-revision";
import { assertExpectedPostRevision } from "./post-write-transaction";

describe("server-side post snapshot", () => {
  it("detects edits even with an identical timestamp", () => {
    const before = {
      updatedAt: "2026-09-12T00:00:00Z",
      contentNo: "Reviewed",
      editorialStatus: "approved",
    };
    const after = { ...before, contentNo: "Unreviewed" };
    expect(() =>
      assertExpectedPostRevision(
        { expectedBlogRevision: postRevision(before) },
        after,
      ),
    ).toThrow("Article changed");
  });
  it("normalizes relation depth and object order without hiding content changes", () => {
    expect(
      postRevision({
        heroImage: 12,
        stockImage: { assetId: "1", provider: "pexels" },
      }),
    ).toBe(
      postRevision({
        stockImage: { provider: "pexels", assetId: "1" },
        heroImage: { id: 12, url: "/image.jpg" },
      }),
    );
    expect(
      postRevision({
        sources: [{ id: "x", url: "https://example.invalid/a" }],
      }),
    ).not.toBe(
      postRevision({
        sources: [{ id: "x", url: "https://example.invalid/b" }],
      }),
    );
  });
});
