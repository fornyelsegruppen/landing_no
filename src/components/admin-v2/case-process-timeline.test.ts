import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseProcessTimeline } from "./case-process-timeline";

const stageContent = {
  contact: {
    sectionHref: "#customer-section" as const,
    statusText: "Kontakt registruotas",
    timestamp: "2026-08-29 12:54",
  },
  measurement: {
    sectionHref: "#measurement-section" as const,
  },
  commercial: {
    sectionHref: "#commercial-section" as const,
    relatedLinks: [
      {
        kind: "document" as const,
        href: "/api/admin/quotes/17/T-17-V1.pdf",
        label: "T-17-V1 PDF",
        accessibleName: "Atidaryti pasiūlymo T-17-V1 PDF",
        openInNewTab: true,
      },
    ],
  },
  agreement: {
    sectionHref: "#contract-section" as const,
    relatedLinks: [
      {
        kind: "recovery" as const,
        href: "#cancellation-review-title",
        label: "Peržiūrėti atšaukimo prašymą",
        accessibleName: "Pereiti į atšaukimo prašymo peržiūrą",
      },
    ],
  },
  work: {
    sectionHref: "#work-section" as const,
  },
  completion: {
    sectionHref: "#documents-section" as const,
  },
};

describe("case process timeline", () => {
  it("renders six localized stages and marks the current step accessibly", () => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "commercial",
        locale: "lt",
        stageContent,
      }),
    );

    expect(html.match(/data-process-stage=/g)).toHaveLength(6);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain('data-process-stage="commercial"');
    expect(html).toContain('data-process-state="current"');
    expect(html).toContain("Kaina ir pasiūlymas");
    expect(html).toContain("Dabartinis etapas");
  });

  it("does not make future stages or their supplied targets interactive", () => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "measurement",
        locale: "lt",
        stageContent,
      }),
    );

    expect(html).toContain('href="#measurement-section"');
    expect(html).not.toContain('href="#commercial-section"');
    expect(html).not.toContain("/api/admin/quotes/17/T-17-V1.pdf");
    expect(html).not.toContain('href="#contract-section"');
    expect(html).not.toContain('href="#work-section"');
    expect(html).not.toContain('href="#documents-section"');
  });

  it("uses exact section, document and recovery targets with accessible names", () => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "agreement",
        activeStageState: "blocked",
        locale: "lt",
        stageContent,
      }),
    );

    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Etapas užblokuotas");
    expect(html).toContain('href="#commercial-section"');
    expect(html).toContain('href="/api/admin/quotes/17/T-17-V1.pdf"');
    expect(html).toContain('aria-label="Atidaryti pasiūlymo T-17-V1 PDF"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('href="#cancellation-review-title"');
    expect(html).toContain('aria-label="Pereiti į atšaukimo prašymo peržiūrą"');
  });

  it("supports the fragment-to-focusable-heading integration contract", () => {
    const renderedTargets = [
      "customer-section",
      "measurement-section",
      "commercial-section",
      "contract-section",
      "cancellation-review-title",
    ];
    const html = renderToStaticMarkup(
      createElement(
        "main",
        null,
        createElement(CaseProcessTimeline, {
          activeStageId: "agreement",
          activeStageState: "blocked",
          locale: "lt",
          stageContent,
        }),
        ...renderedTargets.map((id) =>
          createElement("h2", { id, key: id, tabIndex: -1 }, id),
        ),
      ),
    );
    const fragmentTargets = Array.from(
      html.matchAll(/href="#([^"]+)"/g),
      (match) => match[1],
    );

    expect(fragmentTargets).toEqual(renderedTargets);
    for (const target of fragmentTargets) {
      expect(html).toContain(`id="${target}" tabindex="-1"`);
    }
  });

  it("preserves the supplied audit history under a touch-friendly details control", () => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "completion",
        auditHistory: createElement(
          "ol",
          { "data-testid": "legacy-audit" },
          createElement("li", null, "Senas audito įvykis"),
        ),
        historyId: "timeline-section",
        locale: "lt",
        stageContent,
      }),
    );

    expect(html).toContain('<details id="timeline-section"');
    expect(html).toContain("Visa istorija");
    expect(html).toContain("Senas audito įvykis");
    expect(html).toContain("min-h-12");
    expect(html).toContain("motion-reduce:transition-none");
  });

  it.each([
    ["en", "Case process", "Customer decision and contract"],
    ["nb", "Saksprosess", "Kundebeslutning og kontrakt"],
  ] as const)("localizes process copy for %s", (locale, title, stage) => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "agreement",
        locale,
        stageContent,
      }),
    );

    expect(html).toContain(title);
    expect(html).toContain(stage);
  });

  it("uses one column on phones and a compact multi-column layout where space allows", () => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "work",
        locale: "lt",
        stageContent,
      }),
    );

    expect(html).toContain("grid gap-3 sm:grid-cols-2 xl:grid-cols-1");
    expect(html).toContain("min-h-12");
    expect(html).toContain("break-words");
  });
});
