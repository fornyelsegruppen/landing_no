import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseStatusStamp } from "./case-status-stamp";

describe("case status stamp", () => {
  it("renders a semantic transition time next to the status", () => {
    const html = renderToStaticMarkup(
      createElement(CaseStatusStamp, {
        dateTime: "2026-08-28T12:35:00.000Z",
        label: "Pristatyta",
        timestamp: "2026-08-28 14:35",
        tone: "success",
      }),
    );

    expect(html).toContain("Pristatyta");
    expect(html).toContain("2026-08-28 14:35");
    expect(html).toContain('dateTime="2026-08-28T12:35:00.000Z"');
    expect(html).toContain("border-success/45");
    expect(html).toMatch(
      /border-success\/45[^>]*><span[^>]*>Pristatyta<\/span><time/,
    );
  });

  it("does not invent a time when the transition has no timestamp", () => {
    const html = renderToStaticMarkup(
      createElement(CaseStatusStamp, { label: "Juodraštis" }),
    );

    expect(html).not.toContain("<time");
  });
});
