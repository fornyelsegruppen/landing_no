import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseHistoryEventDetail } from "./case-history-event-detail";

describe("case history event detail", () => {
  it("renders one exact event with localized facts and documentation links", () => {
    const html = renderToStaticMarkup(
      createElement(CaseHistoryEventDetail, {
        eventId: "quote-17",
        eventType: "Pasiūlymas",
        facts: [{ label: "Versija", value: "1" }],
        links: [
          {
            href: "/api/admin/quotes/17/pdf",
            kind: "document",
            label: "T-17-V1 PDF",
          },
          {
            href: "/admin/collections/quotes/17",
            kind: "source",
            label: "T-17-V1 šaltinio įrašas",
          },
        ],
        locale: "lt",
        occurredAt: "2026-08-29 12:54",
        reference: "T-17-V1",
        status: "Išsiųsta",
        summary: "Pasiūlymas išsiųstas klientui.",
      }),
    );

    expect(html).toContain('data-case-history-event="quote-17"');
    expect(html).toContain("Šio įvykio dokumentacija");
    expect(html).toContain("Užregistruota");
    expect(html).toContain("Išsiųsta");
    expect(html).toContain("Pasiūlymas išsiųstas klientui.");
    expect(html).toContain('href="/api/admin/quotes/17/pdf"');
    expect(html).toContain('href="/admin/collections/quotes/17"');
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
  });

  it.each([
    ["en", "Documentation for this event"],
    ["nb", "Dokumentasjon for denne hendelsen"],
  ] as const)("localizes event documentation for %s", (locale, label) => {
    const html = renderToStaticMarkup(
      createElement(CaseHistoryEventDetail, {
        eventId: "lead-16",
        eventType: "Klientas",
        links: [],
        locale,
        occurredAt: "2026-08-29 12:54",
        reference: "#16",
      }),
    );

    expect(html).toContain(label);
  });
});
