import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import { CaseLifecyclePanel } from "./case-lifecycle-panel";

describe("case lifecycle panel", () => {
  it("keeps active-case archive and trash actions in a collapsed compact drawer", () => {
    const html = renderToStaticMarkup(
      createElement(CaseLifecyclePanel, {
        leadId: 17,
        locale: "lt",
        recordState: "active",
      }),
    );

    expect(html).toContain('<details class="group');
    expect(html).not.toContain('<details class="group" open');
    expect(html).toContain('id="case-lifecycle-title"');
    expect(html).toContain("Archyvas ir šiukšlinė");
    expect(html).toContain("Aktyvi byla");
    expect(html).toContain("Archyvuoti bylą");
    expect(html).toContain("Perkelti į šiukšlinę");
    expect(html).toContain("Klasifikacija");
    expect(html).not.toContain("Ištrinti visam laikui");
  });

  it("separates restore and trash actions for an archived case", () => {
    const html = renderToStaticMarkup(
      createElement(CaseLifecyclePanel, {
        classification: "declined",
        leadId: 17,
        locale: "en",
        recordState: "archived",
      }),
    );

    expect(html).toContain("Archived case");
    expect(html).toContain("Restore case");
    expect(html).toContain("Move to trash");
    expect(html).not.toContain("Classification");
    expect(html).not.toContain("Delete permanently");
    expect(html).toContain("border-danger/30");
  });

  it("keeps permanent deletion behind a second confirmation drawer", () => {
    const html = renderToStaticMarkup(
      createElement(CaseLifecyclePanel, {
        leadId: 17,
        locale: "nb",
        purgeAfter: "2026-09-28T12:00:00.000Z",
        recordState: "trashed",
      }),
    );

    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html).toContain("Sak i papirkurven");
    expect(html).toContain("Gjenopprett saken");
    expect(html).toContain("Slett permanent");
    expect(html).toContain("Skriv saksnummeret for å bekrefte");
    expect(html).toContain('inputMode="numeric"');
    expect(html).not.toContain("Flytt til papirkurven");
  });

  it("retains touch-sized controls and responsive action layout", () => {
    const html = renderToStaticMarkup(
      createElement(CaseLifecyclePanel, {
        leadId: 17,
        locale: "lt",
        recordState: "active",
      }),
    );

    expect(html).toContain("min-h-14");
    expect(html).toContain("min-h-12");
    expect(html).toContain("lg:grid-cols-2");
    expect(html).toContain("w-full");
    expect(html).toContain("sm:w-auto");
  });
});
