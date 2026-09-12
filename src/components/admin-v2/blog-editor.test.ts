import { createElement } from "react";
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
});
