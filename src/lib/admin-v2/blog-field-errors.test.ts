import { describe, expect, it } from "vitest";
import {
  blogDraftFieldIssues,
  blogFieldIssueMessage,
  blogGateErrorMessage,
  parseBlogFieldIssues,
} from "./blog-field-errors";
describe("blog draft field validation and localized errors", () => {
  it("accepts unfinished nonempty text without treating it as publishable", () => {
    expect(
      blogDraftFieldIssues({ titleNo: "Utkast", contentNo: "Arbeid pågår." }),
    ).toEqual([]);
  });
  it("bounds field issues and ignores arbitrary field names or echoed input", () => {
    expect(
      parseBlogFieldIssues([
        { field: "contentNo", code: "required", input: "private text" },
        { field: "constructor", code: "required" },
        { field: "contentNo", code: "invalid" },
      ]),
    ).toEqual([{ field: "contentNo", code: "required" }]);
    expect(
      blogDraftFieldIssues({
        titleNo: "Title",
        contentNo: " ",
        excerptNo: "x".repeat(501),
      }),
    ).toEqual([
      { field: "contentNo", code: "required" },
      { field: "excerptNo", code: "too_long" },
    ]);
  });
  it.each(["lt", "nb", "en"] as const)(
    "provides field and quality-gate copy for %s",
    (locale) => {
      expect(
        blogFieldIssueMessage({ field: "contentNo", code: "too_long" }, locale),
      ).toContain("30000");
      expect(blogGateErrorMessage("QUALITY_NOT_READY", locale)).toBeTruthy();
      expect(
        blogGateErrorMessage("PUBLICATION_NOT_READY", locale),
      ).toBeTruthy();
      expect(blogGateErrorMessage("unexpected raw error", locale)).toBeNull();
    },
  );
});
