import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BlockerSummary,
  OwnerChip,
  StatusBadge,
  SyncState,
  VersionBadge,
} from "./admin-status-primitives";

describe("unified admin semantic primitives", () => {
  it("communicates meaning with text and icons instead of color alone", () => {
    const blocked = renderToStaticMarkup(
      createElement(StatusBadge, { kind: "blocked" }),
    );
    const attention = renderToStaticMarkup(
      createElement(StatusBadge, { kind: "attention" }),
    );
    const resolved = renderToStaticMarkup(
      createElement(StatusBadge, { kind: "resolved" }),
    );
    const blocker = renderToStaticMarkup(
      createElement(BlockerSummary, null, "Trūksta įrodymo"),
    );
    expect(blocked).toContain("Užblokuota");
    expect(attention).toContain("Reikia dėmesio");
    expect(attention).toContain("var(--an-amber)");
    expect(resolved).toContain("Išspręsta");
    expect(blocker).toContain('aria-label="Blokatorius"');
    expect(blocked).toContain("var(--an-danger)");
    expect(blocked).not.toContain("var(--an-action)");
  });

  it("distinguishes current and historical versions explicitly", () => {
    expect(
      renderToStaticMarkup(createElement(VersionBadge, { version: "v4" })),
    ).toContain("dabartinė");
    expect(
      renderToStaticMarkup(
        createElement(VersionBadge, { current: false, version: "v3" }),
      ),
    ).toContain("ankstesnė");
  });

  it("localizes framework-owned semantic text without leaking Lithuanian", () => {
    const english = [
      createElement(StatusBadge, { kind: "blocked", locale: "en" }),
      createElement(OwnerChip, { locale: "en", unassigned: true }),
      createElement(VersionBadge, { locale: "en", version: "v4" }),
      createElement(SyncState, { kind: "synced", locale: "en" }),
    ]
      .map((element) => renderToStaticMarkup(element))
      .join(" ");
    expect(english).toContain("Blocked");
    expect(english).toContain("Unassigned");
    expect(english).toContain("current");
    expect(english).toContain("Synced");
    expect(english).not.toMatch(
      /Užblokuota|Be atsakingo|dabartinė|Sinchronizuota/,
    );
  });
});
