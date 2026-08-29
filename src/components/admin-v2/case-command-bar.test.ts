import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseCommandBar } from "./case-command-bar";

const props = {
  action: "Susisiekti dėl atsisakymo arba uždaryti bylą K-17-V1",
  amount: "12 660 NOK",
  caseLabel: "Kliento byla",
  caseNumber: 17,
  customer: "UAT Question Flow 2026-08-28",
  effectiveLabel: "Galiojanti sutartis",
  effectiveReference: "Dar nėra",
  nextActionLabel: "Kitas veiksmas",
  status: "Atmesta",
  workingLabel: "Vykdoma versija",
  workingReference: "K-17-V1",
};

describe("case command bar", () => {
  it("uses the danger tone for a declined offer while remaining a shortcut", () => {
    const html = renderToStaticMarkup(
      createElement(CaseCommandBar, { ...props, tone: "danger" }),
    );

    expect(html).toContain("border-danger/45");
    expect(html).toContain("text-danger");
    expect(html).toContain('href="#next-action-title"');
    expect(html).not.toContain("<button");
  });
});
