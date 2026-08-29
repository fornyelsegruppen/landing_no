import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@radix-ui/react-dialog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@radix-ui/react-dialog")>();

  return {
    ...actual,
    Portal: ({ children }: { children?: ReactNode }) =>
      createElement(Fragment, null, children),
  };
});

import { CaseInspector, type CaseInspectorProps } from "./case-inspector";

function renderInspector(open = true) {
  return renderToStaticMarkup(
    createElement(
      CaseInspector,
      {
        closeLabel: "Uždaryti bylos informaciją",
        description: "Išsami pasirinkto etapo informacija",
        onClose: () => undefined,
        open,
        title: "Kaina ir pasiūlymas",
      } as CaseInspectorProps,
      createElement("p", null, "Inspector turinys"),
    ),
  );
}

describe("case inspector", () => {
  it("renders controlled modal dialog semantics and an accessible close control", () => {
    const html = renderInspector();

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
    expect(html).toMatch(/aria-describedby="[^"]+"/);
    expect(html).toContain("Kaina ir pasiūlymas");
    expect(html).toContain("Išsami pasirinkto etapo informacija");
    expect(html).toContain("Inspector turinys");
    expect(html).toContain('aria-label="Uždaryti bylos informaciją"');
    expect(html).toContain('type="button"');
  });

  it("is fullscreen on phones, near-full on tablets and a right drawer on desktop", () => {
    const html = renderInspector();

    expect(html).toContain("fixed inset-0");
    expect(html).toContain("h-[100dvh] w-screen");
    expect(html).toContain("sm:w-[calc(100vw-1.5rem)]");
    expect(html).toContain("sm:max-w-none");
    expect(html).toContain("xl:right-0");
    expect(html).toContain("xl:w-[min(46vw,44rem)]");
    expect(html).toContain("xl:rounded-l-3xl");
  });

  it("keeps the header fixed and gives long server-slot content its own scroll region", () => {
    const html = renderInspector();

    expect(html).toContain('data-case-inspector=""');
    expect(html).toContain('data-case-inspector-body=""');
    expect(html).toContain('data-case-inspector-scroll=""');
    expect(html).toContain("flex h-[100dvh]");
    expect(html).toContain("shrink-0");
    expect(html).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain");
    expect(html).toContain("size-12");
  });

  it("does not mount the inspector surface while controlled closed", () => {
    expect(renderInspector(false)).not.toContain("data-case-inspector");
  });
});
