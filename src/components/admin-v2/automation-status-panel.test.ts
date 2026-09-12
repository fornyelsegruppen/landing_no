import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AutomationStatusPanel } from "./automation-status-panel";

describe("automation status panel", () => {
  it("fails closed and localizes status", () => {
    expect(renderToStaticMarkup(createElement(AutomationStatusPanel, { status: { kind: "unavailable" }, locale: "lt" }))).toContain("nepasiekiama");
    expect(renderToStaticMarkup(createElement(AutomationStatusPanel, { status: { kind: "configured" }, locale: "no" }))).toContain("konfigurert");
    expect(renderToStaticMarkup(createElement(AutomationStatusPanel, { status: { kind: "verified", nextRunAt: "2026-09-12T10:00", timeZone: "Europe/Oslo" }, locale: "en" }))).toContain("Human approval remains required");
  });
});
