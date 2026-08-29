import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseCommandBar } from "./case-command-bar";

const props = {
  action: "Susisiekti dėl atsisakymo arba uždaryti bylą K-17-V1",
  amount: "12 660 NOK",
  caseLabel: "Kliento byla",
  caseNumber: 17,
  children: createElement("div", null, "Veiksmo informacija"),
  closeDetailsLabel: "Slėpti informaciją",
  customer: "UAT Question Flow 2026-08-28",
  effectiveLabel: "Galiojanti sutartis",
  effectiveReference: "Dar nėra",
  nextActionLabel: "Kitas veiksmas",
  openDetailsLabel: "Rodyti informaciją",
  status: "Atmesta",
  workingLabel: "Vykdoma versija",
  workingReference: "K-17-V1",
};

describe("case command bar", () => {
  it("uses the danger tone for a declined offer while remaining an inline disclosure", () => {
    const html = renderToStaticMarkup(
      createElement(CaseCommandBar, { ...props, tone: "danger" }),
    );

    expect(html).toContain("border-danger/45");
    expect(html).toContain("text-danger");
    expect(html).toContain('aria-controls="case-primary-action-panel"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('href="#next-action-title"');
  });

  it.each([
    ["critical", "border-danger/45", "text-danger"],
    ["warning", "border-amber-400/45", "text-amber-200"],
    ["action", "border-accent/30", "text-accent"],
    ["waiting", "border-sky-400/35", "text-sky-200"],
    ["success", "border-success/45", "text-success"],
    ["neutral", "border-white/20", "text-white/80"],
  ] as const)(
    "renders a distinct %s semantic tone",
    (tone, borderClass, emphasisClass) => {
      const html = renderToStaticMarkup(
        createElement(CaseCommandBar, { ...props, tone }),
      );

      expect(html).toContain(borderClass);
      expect(html).toContain(emphasisClass);
    },
  );

  it("marks both responsive variants as primary shortcuts", () => {
    const html = renderToStaticMarkup(
      createElement(CaseCommandBar, { ...props, tone: "waiting" }),
    );

    expect(html.match(/data-case-primary-shortcut=/g)).toHaveLength(2);
    expect(html).toContain('data-case-primary-shortcut="desktop"');
    expect(html).toContain('data-case-primary-shortcut="mobile"');
    expect(
      html.match(/aria-controls="case-primary-action-panel"/g),
    ).toHaveLength(2);
    expect(html).toContain('id="case-primary-action-panel"');
    expect(html).toContain("Rodyti informaciją");
    expect(html).not.toContain('href="#next-action-title"');
  });
});
