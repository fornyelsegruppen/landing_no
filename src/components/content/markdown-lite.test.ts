import { describe, expect, it } from "vitest";
import { safeContentHref } from "@/lib/safe-content-link";
import { parseMarkdownBlocks } from "./markdown-lite";

describe("safe Markdown links", () => {
  it("localizes internal routes", () => {
    expect(safeContentHref("/takvask", "no")).toBe("/no/takvask");
    expect(safeContentHref("/en/takvask", "no")).toBe("/en/takvask");
  });

  it("allows web links and rejects executable schemes", () => {
    expect(safeContentHref("https://www.kartverket.no", "no")).toBe(
      "https://www.kartverket.no",
    );
    expect(safeContentHref("javascript:alert(1)", "no")).toBeNull();
    expect(safeContentHref("data:text/html,test", "no")).toBeNull();
  });
});

describe("Markdown block parsing", () => {
  it("keeps headings separate when generated Markdown omits blank lines", () => {
    expect(
      parseMarkdownBlocks(
        "## Kort svar\nDette er et eget avsnitt.\n- Første punkt\n- Andre punkt\n### Neste del\nMer tekst.",
      ),
    ).toEqual([
      { type: "heading", level: 2, content: "Kort svar" },
      { type: "paragraph", content: "Dette er et eget avsnitt." },
      { type: "unordered-list", items: ["Første punkt", "Andre punkt"] },
      { type: "heading", level: 3, content: "Neste del" },
      { type: "paragraph", content: "Mer tekst." },
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
