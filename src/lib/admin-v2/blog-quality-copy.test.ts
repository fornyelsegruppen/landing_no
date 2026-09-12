import { describe, expect, it } from "vitest";
import {
  blogQualityGateLabel,
  blogQualityIssueMessage,
} from "./blog-quality-copy";
describe("operator quality feedback", () => {
  it.each([
    ["lt", "simbolių", "žodžių"],
    ["nb", "tegn", "ord"],
    ["en", "characters", "words"],
  ] as const)(
    "separates the character gate from the word-count warning in %s",
    (locale, characters, words) => {
      const schema = blogQualityIssueMessage(
        { code: "invalid_output", message: "content: Invalid input" },
        locale,
      );
      expect(schema).toContain("700–15000");
      expect(schema).toContain(characters);
      expect(schema).not.toContain("Invalid input");
      const warning = blogQualityIssueMessage(
        { code: "content_too_short", message: "raw source" },
        locale,
      );
      expect(warning).toContain("700");
      expect(warning).toContain(words);
      expect(warning).not.toContain("15000");
      expect(blogQualityGateLabel("schema", locale)).not.toBe("schema");
      for (const field of ["internalLinks", "faq", "imageBrief", "imageAlt"])
        expect(
          blogQualityIssueMessage(
            { code: "invalid_output", message: `${field}: Invalid input` },
            locale,
          ),
        ).not.toContain("Invalid input");
    },
  );
});
