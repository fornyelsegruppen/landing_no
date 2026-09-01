import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextDocumentPreflight } from "@/components/admin-next/admin-next-document-preflight";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

const preflight = adminNextCaseWorkspaceFixture.documentPreflight;
const measurement = adminNextCaseWorkspaceFixture.measurementReview;

describe("Admin Next document package preflight", () => {
  it("presents all exact artifact identities and PS-SEND-007 sequence", () => {
    expect(preflight).toBeDefined();
    expect(measurement).toBeDefined();
    if (!preflight || !measurement) return;
    const html = renderToStaticMarkup(
      createElement(AdminNextDocumentPreflight, {
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        locale: "lt",
        measurementFallbackHref: measurement.fallbackHref,
        preflight,
      }),
    );

    expect(html).toContain("PS-SEND-007");
    expect(html).toContain("R4-2026-1042");
    expect(html).toContain("PRICE-1042-R12");
    expect(html).toContain("Q-1042-R12");
    expect(html).toContain("C-1042-DRAFT-R03");
    expect(html).toContain("RECIPIENT-1042-R02");
    expect(html).toContain("PDF-1042-R12");
  });

  it("keeps combined send disabled and exposes only the exact measurement fallback", () => {
    expect(preflight).toBeDefined();
    expect(measurement).toBeDefined();
    if (!preflight || !measurement) return;
    const html = renderToStaticMarkup(
      createElement(AdminNextDocumentPreflight, {
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        locale: "lt",
        measurementFallbackHref: measurement.fallbackHref,
        preflight,
      }),
    );

    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Send yra fail-closed");
    expect(html).toContain(`href="${measurement.fallbackHref}"`);
    expect(html).not.toContain(`href="${preflight.fallbackHref}"`);
  });
});
