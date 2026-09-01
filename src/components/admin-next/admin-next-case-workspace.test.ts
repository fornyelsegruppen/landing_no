import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextCaseWorkspace } from "@/components/admin-next/admin-next-case-workspace";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

describe("Admin Next Case Workspace preview", () => {
  it("renders owner, SLA, progress, evidence and timeline landmarks", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        value: adminNextCaseWorkspaceFixture,
      }),
    );

    expect(html).toContain("Marius Hansen");
    expect(html).toContain("Vėluoja 38 min.");
    expect(html).toContain("Bylos eiga");
    expect(html).toContain("Dokumentai ir įrodymai");
    expect(html).toContain("R4 stogo matavimas");
    expect(html).toContain("Įvykių seka");
  });

  it("contains only working links and no fake active controls", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        value: adminNextCaseWorkspaceFixture,
      }),
    );

    expect(html).not.toContain("<button");
    expect(html.match(/href="\/admin-v2\//g)?.length).toBeGreaterThanOrEqual(7);
    expect(html).toContain("Preview nekeičia klientų duomenų");
  });
});
