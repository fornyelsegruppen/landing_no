import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftPreviewBanner } from "./draft-preview-banner";

describe("draft preview banner", () => {
  it("uses the existing GET exit endpoint for public locales", () => {
    const no = renderToStaticMarkup(createElement(DraftPreviewBanner, { locale: "no" }));
    const en = renderToStaticMarkup(createElement(DraftPreviewBanner, { locale: "en" }));
    expect(no).toContain("/api/exit-preview?locale=no");
    expect(en).toContain("/api/exit-preview?locale=en");
  });
});
