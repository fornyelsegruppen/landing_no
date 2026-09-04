import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextRfCaseAddressContext } from "./admin-next-rf-case-address-context";

describe("Admin Next RF authoritative case address", () => {
  it("renders the case binding and correction consequences without a free address input", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRfCaseAddressContext, {
        address: "Lyngveien 28A, 1182 Oslo",
        caseReference: "TF-13",
        caseRevision: 18,
        editHref: "/admin-v2/cases/13#measurement-section",
        locale: "lt",
        measurementRevision: 7,
      }),
    );

    expect(html).toContain('data-rf-address-context="case_authoritative"');
    expect(html).toContain('data-rf-free-address-input="forbidden"');
    expect(html).toContain("Bylos adresas");
    expect(html).toContain("Lyngveien 28A, 1182 Oslo");
    expect(html).toContain("TF-13 · case r18 · RF r7");
    expect(html).toContain("Taisyti bylos adresą");
    expect(html).toContain("Adreso pakeitimo pasekmės");
    expect(html).toContain("ortofoto, DOM/DTM, pasirinktas pastatas");
    expect(html).toContain("Istorija nebus ištrinta");
    expect(html).toContain("ReviewAndCommit");
    expect(html).toContain('href="/admin-v2/cases/13#measurement-section"');
    expect(html).not.toContain("<input");
    expect(html).not.toContain('name="addressQuery"');
  });

  it("fails closed when the guarded case correction target is unavailable", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRfCaseAddressContext, {
        address: "Lyngveien 28A, 1182 Oslo",
        caseReference: "TF-13",
        locale: "lt",
      }),
    );

    expect(html).toContain("Adreso keitimui reikalingas saugus bylos procesas");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("<input");
  });

  it("prefers the revision-bound Preview correction control over the legacy target", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRfCaseAddressContext, {
        address: "Lyngveien 28A, 1182 Oslo",
        addressCorrection: {
          caseId: 13,
          currentAddress: {
            city: "Oslo",
            houseNumber: "28A",
            postalCode: "1182",
            street: "Lyngveien",
          },
          expectedAddressRevision: 4,
          expectedCaseRevision: 18,
        },
        caseReference: "TF-13",
        caseRevision: 18,
        editHref: "/admin-v2/cases/13#measurement-section",
        locale: "lt",
        measurementRevision: 7,
      }),
    );

    expect(html).toContain('data-address-correction-control="true"');
    expect(html).toContain("Taisyti bylos adresą");
    expect(html).not.toContain('href="/admin-v2/cases/13#measurement-section"');
    expect(html).not.toContain("<input");
  });
});
