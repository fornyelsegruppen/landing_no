// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { BlogEditor } from "./blog-editor";

const props = {
  id: 3,
  locale: "lt" as const,
  titleNo: "Slik sjekker du taket etter vinteren",
  excerptNo: "Trumpa santrauka",
  contentNo: "Pakankamai ilgas straipsnio tekstas.",
  seoTitleNo: "SEO pavadinimas",
  seoDescriptionNo: "SEO aprašymas",
  primaryKeyword: "tak etter vinter",
  reviewerName: "Kari",
  status: "human_review",
  qualityPassed: false,
  qualityScore: null,
  publishEligible: false,
  scheduledAt: "2026-09-12T08:30:00.000Z",
  schedulerEnabled: false,
  updatedAt: "2026-09-12T10:00:00.000Z",
};

describe("blog editor", () => {
  it("renders the recheck action, visibly locked publish action, and narrow-safe action wrap", () => {
    const html = renderToStaticMarkup(createElement(BlogEditor, props));

    expect(html).toContain("Atlikti kokybės patikrą iš naujo");
    expect(html).toContain("Publikavimas užrakintas");
    expect(html).toContain("flex flex-wrap gap-3");
    expect(html).toContain("disabled:cursor-not-allowed");
    expect(html).toContain("Ką reikia pagerinti?");
    expect(html).toContain(
      "Išsaugotas planas: 2026-09-12T10:30 (Europe/Oslo).",
    );
    expect(html).toContain("Planavimas sustabdytas funkcijos nustatymu.");
    expect(html).toContain("Laikas visada interpretuojamas kaip Europe/Oslo.");
  });

  it("keeps the Oslo time-zone label when no saved plan exists", () => {
    const html = renderToStaticMarkup(
      createElement(BlogEditor, { ...props, scheduledAt: undefined }),
    );

    expect(html).toContain("Laikas visada interpretuojamas kaip Europe/Oslo.");
    expect(html).not.toContain("Išsaugotas planas:");
  });

  it.each([
    [
      "2026-03-29T02:30",
      "Pasirinktas Oslo laikas neegzistuoja dėl vasaros laiko. Pasirinkite kitą laiką.",
    ],
    [
      "2026-10-25T02:30",
      "Pasirinktas Oslo laikas pereinant į žiemos laiką pasikartoja du kartus. Pasirinkite kitą, vienareikšmį laiką.",
    ],
    ["2026-10-25T02:30:20", "Prieš planuodami įveskite tinkamą Oslo laiką."],
  ])(
    "shows the schedule validation target for a human-review article without a button click (%s)",
    async (scheduledAt, message) => {
      const reactTestEnvironment = globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      };
      reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      try {
        await act(async () => {
          root.render(
            createElement(BlogEditor, { ...props, scheduledAt: undefined }),
          );
        });
        const scheduleInput = container.querySelector<HTMLInputElement>(
          'input[type="datetime-local"]',
        );
        expect(scheduleInput).not.toBeNull();
        const inputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        expect(inputValueSetter).toBeDefined();

        await act(async () => {
          inputValueSetter?.call(scheduleInput, scheduledAt);
          scheduleInput?.dispatchEvent(new Event("input", { bubbles: true }));
        });

        expect(scheduleInput?.getAttribute("aria-describedby")).toBe(
          "blog-schedule-zone blog-schedule-validation",
        );
        expect(scheduleInput?.getAttribute("aria-invalid")).toBe("true");
        expect(
          container.querySelector("#blog-schedule-validation")?.textContent,
        ).toBe(message);
        expect(container.textContent).toContain(
          "Planavimas bus galimas po specialisto patvirtinimo.",
        );
      } finally {
        await act(async () => root.unmount());
        container.remove();
        reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
      }
    },
  );
});
