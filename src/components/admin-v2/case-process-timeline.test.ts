import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CaseProcessTimeline,
  resolveCaseProcessInspectorContent,
  restoreInspectorTriggerFocus,
} from "./case-process-timeline";

const stageContent = {
  contact: {
    inspectorTargetId: "customer-section",
    statusText: "Kontakt registruotas",
    timestamp: "2026-08-29 12:54",
  },
  measurement: {
    inspectorTargetId: "measurement-section",
  },
  commercial: {
    inspectorTargetId: "price-quote-section",
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
    inspectorTargetId: "contract-section",
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
    inspectorTargetId: "work-section",
  },
  completion: {
    inspectorTargetId: "documents-section",
  },
};

describe("case process timeline", () => {
  it("returns focus to the inspector trigger without scrolling the workspace", () => {
    const focus = vi.fn();
    const schedule = vi.fn((callback: () => void) => callback());

    restoreInspectorTriggerFocus({ focus }, schedule);

    expect(schedule).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

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

  it("does not expose page fragment navigation for present or future stages", () => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "measurement",
        locale: "lt",
        stageContent,
      }),
    );

    expect(html).not.toContain('href="#measurement-section"');
    expect(html).not.toContain('href="#price-quote-section"');
    expect(html).not.toContain("/api/admin/quotes/17/T-17-V1.pdf");
    expect(html).not.toContain('href="#contract-section"');
    expect(html).not.toContain('href="#work-section"');
    expect(html).not.toContain('href="#documents-section"');
  });

  it("keeps external evidence links but suppresses legacy fragment recovery links", () => {
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
    expect(html).not.toContain('href="#price-quote-section"');
    expect(html).toContain('href="/api/admin/quotes/17/T-17-V1.pdf"');
    expect(html).toContain('aria-label="Atidaryti pasiūlymo T-17-V1 PDF"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain('href="#cancellation-review-title"');
    expect(html).not.toContain(
      'aria-label="Pereiti į atšaukimo prašymo peržiūrą"',
    );
  });

  it("keeps the detail registry in the inspector instead of the page flow", () => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "agreement",
        activeStageState: "blocked",
        inspectorContent: createElement(
          "section",
          { id: "contract-section" },
          "Sutarties detalės",
        ),
        locale: "lt",
        stageContent,
        stagePanels: {
          agreement: createElement("p", null, "Sutarties santrauka"),
        },
      }),
    );

    expect(html).toContain("Rodyti visą informaciją");
    expect(html).not.toContain('href="#contract-section"');
  });

  it("renders history as inspector buttons without fragment links", () => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "completion",
        historyItems: [
          {
            content: createElement(
              "article",
              { id: "messages-section" },
              "Konkretaus audito įrašo detalės",
            ),
            description: "2026-08-29 12:54 · Žinutė",
            id: "message-17",
            inspectorTargetId: "messages-section",
            status: "Pristatyta",
            title: "Senas audito įvykis",
          },
        ],
        historyId: "timeline-section",
        locale: "lt",
        stageContent,
      }),
    );

    expect(html).toContain('<details id="timeline-section"');
    expect(html).toContain("Visa istorija");
    expect(html).toContain("Senas audito įvykis");
    expect(html).toContain("Pristatyta");
    expect(html).not.toContain('href="#messages-section"');
    expect(html).toContain("min-h-12");
    expect(html).toContain("motion-reduce:transition-none");
  });

  it("selects history-specific content while stage selection keeps the common registry", () => {
    const registry = createElement(
      "div",
      { id: "case-registry" },
      "Bendras detalių registras",
    );
    const historyContent = createElement(
      "article",
      { id: "message-17-details" },
      "Tik pasirinkto istorijos įrašo detalės",
    );
    const fallback = createElement("p", null, "Istorijos santrauka");

    const selectedHistory = renderToStaticMarkup(
      createElement(
        "div",
        null,
        resolveCaseProcessInspectorContent(
          {
            content: historyContent,
            description: "Pristatyta 12:54",
            kind: "history",
            targetId: "message-17-details",
            title: "Senas audito įvykis",
          },
          registry,
          fallback,
        ),
      ),
    );
    const selectedStage = renderToStaticMarkup(
      createElement(
        "div",
        null,
        resolveCaseProcessInspectorContent(
          {
            kind: "stage",
            targetId: "price-quote-section",
            title: "Kaina ir pasiūlymas",
          },
          registry,
          fallback,
        ),
      ),
    );
    const missingHistoryContent = renderToStaticMarkup(
      createElement(
        "div",
        null,
        resolveCaseProcessInspectorContent(
          {
            content: undefined,
            description: "Pristatyta 12:54",
            kind: "history",
            targetId: "message-17-details",
            title: "Senas audito įvykis",
          },
          registry,
          fallback,
        ),
      ),
    );

    expect(selectedHistory).toContain("Tik pasirinkto istorijos įrašo detalės");
    expect(selectedHistory).not.toContain("Bendras detalių registras");
    expect(selectedHistory).not.toContain('href="#message-17-details"');
    expect(selectedStage).toContain("Bendras detalių registras");
    expect(missingHistoryContent).toContain("Istorijos santrauka");
    expect(missingHistoryContent).not.toContain("Bendras detalių registras");
  });

  it("renders the active stage as an inline disclosure without a scroll link", () => {
    const html = renderToStaticMarkup(
      createElement(CaseProcessTimeline, {
        activeStageId: "measurement",
        locale: "lt",
        stageContent,
        stagePanels: {
          measurement: createElement(
            "section",
            { id: "measurement-section" },
            "Matavimo turinys",
          ),
        },
      }),
    );

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="case-process-panel-measurement"');
    expect(html).toContain("w-full items-start");
    expect(html).toContain('id="case-process-panel-measurement"');
    expect(html).toContain("Matavimo turinys");
    expect(html).toContain("Slėpti informaciją");
    expect(html).not.toContain('href="#measurement-section"');
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
