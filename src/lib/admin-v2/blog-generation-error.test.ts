import { expect, it } from "vitest";
import { blogGenerationError } from "./blog-generation-error";

it("explains blocked generation without reporting success", () => {
  const message = blogGenerationError({ code: "article_quality_blocked", issues: [
    { code: "unsafe_roof_advice", message: "Unsafe advice" },
    { code: "content_too_short", message: "Short" },
  ] }, "lt");
  expect(message).toContain("nepublikuotas");
  expect(message).toContain("nesaugus");
  expect(message).toContain("per trumpas");
});
