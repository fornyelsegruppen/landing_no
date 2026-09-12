import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseSelectedRecordDetails } from "./case-selected-record-details";
import { isMetadataOnlyDocument } from "@/lib/admin-v2/documents";

describe("historical metadata-only record presentation", () => {
  it.each([
    ["lt", "PDF nepridėtas"],
    ["nb", "PDF ikke vedlagt"],
    ["en", "PDF not attached"],
  ] as const)(
    "shows truthful noPDF copy and exact invoice metadata in %s",
    (locale, missing) => {
      const html = renderToStaticMarkup(
        createElement(CaseSelectedRecordDetails, {
          locale,
          record: {
            kind: "invoice",
            id: 1,
            reference: "OLD-INVOICE-1",
            status: "draft",
            totalIncVatOre: 125,
            adminNote: "old-only-note",
          },
        }),
      );
      expect(html).toContain('id="invoice-1"');
      expect(html).toContain("OLD-INVOICE-1");
      expect(html).toContain("old-only-note");
      expect(html).toContain(missing);
      expect(html).not.toMatch(/<form|<input|<button|\/api\/admin\/media/);
    },
  );

  it("shows the selected warranty scope and only an existing document link", () => {
    const html = renderToStaticMarkup(
      createElement(CaseSelectedRecordDetails, {
        locale: "en",
        record: {
          kind: "warranty",
          id: 2,
          reference: "OLD-WARRANTY-2",
          status: "expired",
          scope: "old roof scope",
          termsVersion: "v-old",
          documentId: 6,
        },
      }),
    );
    expect(html).toContain('id="warranty-2"');
    expect(html).toContain("old roof scope");
    expect(html).toContain("v-old");
    expect(html).toContain('href="/api/admin/media/6"');
    expect(html).not.toContain("PDF not attached");
  });

  it("treats only the two explicit missing-file fallback branches as metadata links", () => {
    expect(
      isMetadataOnlyDocument({
        type: "invoice_draft",
        filename: "",
        href: "/admin-v2/cases/1?invoiceRecord=1#invoice-1",
      }),
    ).toBe(true);
    expect(
      isMetadataOnlyDocument({
        type: "warranty",
        filename: "",
        href: "/admin-v2/cases/1?warrantyRecord=1#warranty-1",
      }),
    ).toBe(true);
    expect(
      isMetadataOnlyDocument({
        type: "invoice_draft",
        filename: "old.pdf",
        href: "/api/admin/media/5",
      }),
    ).toBe(false);
    expect(
      isMetadataOnlyDocument({
        type: "quote",
        filename: "",
        href: "/admin-v2/cases/1",
      }),
    ).toBe(false);
  });
});
