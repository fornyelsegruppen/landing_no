import { describe, expect, it } from "vitest";
import { safePreviewPath } from "./preview-path";

describe("safePreviewPath", () => {
  it("accepts a same-locale article preview", () => {
    expect(safePreviewPath("no", "/no/blogg/takvask-pris")).toBe(
      "/no/blogg/takvask-pris",
    );
  });

  it("falls back for external, cross-locale and backslash paths", () => {
    expect(safePreviewPath("no", "https://evil.example/")).toBe("/no");
    expect(safePreviewPath("no", "/en/blogg/roof-guide")).toBe("/no");
    expect(safePreviewPath("no", "/no/\\evil.example")).toBe("/no");
  });
});
