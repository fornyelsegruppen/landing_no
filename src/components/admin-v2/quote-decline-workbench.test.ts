import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  QuoteDeclineWorkbench,
  quoteDeclineReasonLabel,
} from "./quote-decline-workbench";

const baseProps = {
  comment: "UAT – ingen ekte kunde.",
  declinedAt: "2026-08-29 16:45",
  email: "fornyelsegruppen+uat-question@gmail.com",
  phone: "+4796880883",
  reason: "price",
  reference: "T-17-V1",
};

describe("quote decline workbench", () => {
  it("renders the Lithuanian decline evidence and real contact actions", () => {
    const html = renderToStaticMarkup(
      createElement(QuoteDeclineWorkbench, {
        ...baseProps,
        locale: "lt",
      }),
    );

    expect(html).toContain("Klientas atsisakė pasiūlymo T-17-V1");
    expect(html).toContain("Kaina netinka");
    expect(html).toContain("UAT – ingen ekte kunde.");
    expect(html).toContain("2026-08-29 16:45");
    expect(html).toContain(
      "mailto:fornyelsegruppen+uat-question@gmail.com?subject=Oppf%C3%B8lging%20etter%20avslag%20p%C3%A5%20tilbud%20T-17-V1",
    );
    expect(html).toContain('href="tel:+4796880883"');
    expect(html).toContain("Pereiti prie bylos uždarymo");
    expect(html).not.toContain('href="#case-lifecycle-title"');
  });

  it("keeps the actions touch-friendly and responsive", () => {
    const html = renderToStaticMarkup(
      createElement(QuoteDeclineWorkbench, {
        ...baseProps,
        locale: "lt",
      }),
    );

    expect(html).toContain("min-h-12");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("xl:grid-cols-3");
    expect(html).toContain("break-all");
  });

  it("renders supplied case actions inline instead of a scroll shortcut", () => {
    const html = renderToStaticMarkup(
      createElement(QuoteDeclineWorkbench, {
        ...baseProps,
        caseActions: createElement(
          "div",
          { "data-testid": "case-actions" },
          "Bylos veiksmai",
        ),
        locale: "lt",
      }),
    );

    expect(html).toContain('data-testid="case-actions"');
    expect(html).toContain("Bylos veiksmai");
    expect(html).not.toContain('href="#case-lifecycle-title"');
  });

  it.each([
    ["nb", "Kunden avslo tilbud T-17-V1", "Prisen passer ikke"],
    ["en", "Customer declined offer T-17-V1", "The price does not suit"],
  ] as const)(
    "localizes administrator copy for %s",
    (locale, title, reason) => {
      const html = renderToStaticMarkup(
        createElement(QuoteDeclineWorkbench, {
          ...baseProps,
          locale,
        }),
      );

      expect(html).toContain(title);
      expect(html).toContain(reason);
    },
  );

  it("falls back safely for an unknown reason code", () => {
    expect(quoteDeclineReasonLabel("lt", "legacy_reason")).toBe(
      "legacy_reason",
    );
  });
});
