import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockerSummary, StatusBadge, VersionBadge } from "./admin-status-primitives";

describe("unified admin semantic primitives", () => {
  it("communicates meaning with text and icons instead of color alone", () => {
    const blocked = renderToStaticMarkup(createElement(StatusBadge, { kind: "blocked" }));
    const resolved = renderToStaticMarkup(createElement(StatusBadge, { kind: "resolved" }));
    const blocker = renderToStaticMarkup(createElement(BlockerSummary, null, "Trūksta įrodymo"));
    expect(blocked).toContain("Užblokuota");
    expect(resolved).toContain("Išspręsta");
    expect(blocker).toContain("aria-label=\"Blokatorius\"");
    expect(blocked).toContain("var(--an-danger)");
    expect(blocked).not.toContain("var(--an-action)");
  });

  it("distinguishes current and historical versions explicitly", () => {
    expect(renderToStaticMarkup(createElement(VersionBadge, { version: "v4" }))).toContain("dabartinė");
    expect(renderToStaticMarkup(createElement(VersionBadge, { current: false, version: "v3" }))).toContain("ankstesnė");
  });
});
