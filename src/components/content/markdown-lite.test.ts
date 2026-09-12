import { describe, expect, it } from "vitest";
import { safeContentHref } from "@/lib/safe-content-link";
import { parseMarkdownBlocks } from "./markdown-lite";

describe("safe Markdown links", () => {
  it("localizes internal routes", () => {
    expect(safeContentHref("/takvask", "no")).toBe("/no/takvask");
    expect(safeContentHref("/no#kontakt", "no")).toBe("/no#kontakt");
    expect(safeContentHref("/no/takvask?source=blog#tilbud", "en")).toBe(
      "/no/takvask?source=blog#tilbud",
    );
    expect(safeContentHref("/en/takvask", "no")).toBe("/en/takvask");
    expect(safeContentHref("#kontakt", "en")).toBe("#kontakt");
  });

  it("normalizes same-origin absolute links without making them external", () => {
    expect(
      safeContentHref(
        "https://takfornyelsenorge.no/no#kontakt",
        "no",
      ),
    ).toBe("/no#kontakt");
    expect(
      safeContentHref(
        "https://takfornyelsenorge.no/takvask?source=blog#tilbud",
        "en",
      ),
    ).toBe("/en/takvask?source=blog#tilbud");
  });

  it("allows web links and rejects executable schemes", () => {
    expect(safeContentHref("https://www.kartverket.no", "no")).toBe(
      "https://www.kartverket.no",
    );
    expect(safeContentHref("javascript:alert(1)", "no")).toBeNull();
    expect(safeContentHref("data:text/html,test", "no")).toBeNull();
    expect(safeContentHref("//example.test/path", "no")).toBeNull();
    expect(safeContentHref("/\\example.test/path", "no")).toBeNull();
  });
});

describe("Markdown block parsing", () => {
  it("keeps headings separate when generated Markdown omits blank lines", () => {
    expect(
      parseMarkdownBlocks(
        "## Kort svar\nDette er et eget avsnitt.\n- Første punkt\n- Andre punkt\n### Neste del\nMer tekst.\n#### Vår\nSesongtekst.",
      ),
    ).toEqual([
      { type: "heading", level: 2, content: "Kort svar" },
      { type: "paragraph", content: "Dette er et eget avsnitt." },
      { type: "unordered-list", items: ["Første punkt", "Andre punkt"] },
      { type: "heading", level: 3, content: "Neste del" },
      { type: "paragraph", content: "Mer tekst." },
      { type: "heading", level: 4, content: "Vår" },
      { type: "paragraph", content: "Sesongtekst." },
    ]);
  });

  it("does not absorb an ordered list or quote into the preceding paragraph", () => {
    expect(
      parseMarkdownBlocks("Innledning\n1. Ett\n2. To\n> Viktig råd"),
    ).toEqual([
      { type: "paragraph", content: "Innledning" },
      { type: "ordered-list", items: ["Ett", "To"] },
      { type: "blockquote", content: "Viktig råd" },
    ]);
  });
});
