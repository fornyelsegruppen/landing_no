import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextR4MeasurementReview } from "@/components/admin-next/admin-next-r4-measurement-review";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

const measurement = adminNextCaseWorkspaceFixture.measurementReview;

describe("Admin Next R4 measurement review", () => {
  it("presents the owner-critical measurement facts and provenance", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;
    const html = renderToStaticMarkup(
      createElement(AdminNextR4MeasurementReview, {
        locale: "lt",
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        measurement,
      }),
    );

    expect(html).toContain("186,4");
    expect(html).toContain("82 %");
    expect(html).toContain("Reikia patikrinti 2 kraštus");
    expect(html).toContain("E-04");
    expect(html).toContain("E-11");
    expect(html).toContain("EVD-R4-1042-01");
  });

  it("keeps approval disabled and exposes only the working mutation fallback", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;
    const html = renderToStaticMarkup(
      createElement(AdminNextR4MeasurementReview, {
        locale: "lt",
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        measurement,
      }),
    );

    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Confirm užrakintas");
    expect(html).toContain(`href="${measurement.fallbackHref}"`);
  });

  it("renders four primary slopes, photos, R3 delta and verification gates", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;
    const html = renderToStaticMarkup(
      createElement(AdminNextR4MeasurementReview, {
        locale: "lt",
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        measurement,
      }),
    );

    expect(html).toContain("S1");
    expect(html).toContain("S4");
    expect(html).toContain("Nuotraukos ir šaltiniai");
    expect(html).toContain("Pasikeitė nuo R3");
    expect(html).toContain("Verification gates");
  });
});
