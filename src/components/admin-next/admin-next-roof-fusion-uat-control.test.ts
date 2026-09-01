import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextRoofFusionUatControl } from "./admin-next-roof-fusion-uat-control";

describe("Admin Next Roof Fusion UAT control", () => {
  it("renders an explicit, Preview-only synthetic preparation action", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUatControl, {
        defaultCaseReference: "TF-13",
        locale: "lt",
      }),
    );

    expect(html).toContain('data-roof-fusion-uat="preview-only"');
    expect(html).toContain("Paruošti R4 UAT");
    expect(html).toContain("TF-13");
    expect(html).toContain("Production duomenys neliečiami");
  });
});
