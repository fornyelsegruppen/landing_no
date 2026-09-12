import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DraftPreviewBanner,
  DraftPreviewBoundary,
} from "./draft-preview-banner";

describe("draft preview banner", () => {
  it("uses the existing GET exit endpoint for public locales", () => {
    const no = renderToStaticMarkup(
      createElement(DraftPreviewBanner, { locale: "no" }),
    );
    const en = renderToStaticMarkup(
      createElement(DraftPreviewBanner, { locale: "en" }),
    );
    expect(no).toContain("/api/exit-preview?locale=no");
    expect(en).toContain("/api/exit-preview?locale=en");
    expect(no).toContain("<a");
    expect(no).not.toContain("data-prefetch");
  });

  it("renders only when the server draft mode is enabled", () => {
    const anonymous = renderToStaticMarkup(
      createElement(DraftPreviewBoundary, { enabled: false, locale: "no" }),
    );
    const preview = renderToStaticMarkup(
      createElement(DraftPreviewBoundary, { enabled: true, locale: "en" }),
    );

    expect(anonymous).toBe("");
    expect(preview).toContain("private draft preview");
    expect(preview).toContain("Exit preview");
  });
});
