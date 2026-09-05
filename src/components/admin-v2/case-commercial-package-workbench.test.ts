import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseCommercialPackageWorkbenchModel } from "@/lib/admin-v2/case-commercial-package-workbench-model";

const mocks = vi.hoisted(() => ({ editor: vi.fn() }));

vi.mock("./commercial-quote-editor", () => ({
  CommercialQuoteEditor: (props: unknown) => {
    mocks.editor(props);
    return "commercial-editor";
  },
}));

import { CaseCommercialPackageWorkbench } from "./case-commercial-package-workbench";
import { CommercialQuoteEditor } from "./commercial-quote-editor";

const ready: CaseCommercialPackageWorkbenchModel = {
  status: "ready",
  editor: {
    currentService: "takvask",
    expectedRevision: 9,
    leadId: 17,
    locale: "lt",
    rules: [
      {
        serviceKey: "takvask",
        serviceName: "Takvask",
        unitPriceExVatOre: 12_500,
      },
    ],
    sourceQuoteId: 71,
    unitPriceExVatOre: 14_900,
  },
};

describe("CaseCommercialPackageWorkbench", () => {
  beforeEach(() => mocks.editor.mockClear());

  it("passes the exact pinned read model to the unchanged legacy editor", () => {
    const html = renderToStaticMarkup(
      createElement(CaseCommercialPackageWorkbench, { value: ready }),
    );

    expect(html).toContain("commercial-editor");
    expect(mocks.editor).toHaveBeenCalledOnce();
    expect(mocks.editor).toHaveBeenCalledWith(ready.editor);
  });

  it("fails closed without mounting an executable editor", () => {
    const html = renderToStaticMarkup(
      createElement(CaseCommercialPackageWorkbench, {
        value: { status: "unavailable", reason: "mutations_disabled" },
      }),
    );

    expect(html).toBe("");
    expect(mocks.editor).not.toHaveBeenCalled();
  });

  it("matches the former direct-editor render for rollback parity", () => {
    const legacy = renderToStaticMarkup(
      createElement(CommercialQuoteEditor, ready.editor),
    );
    mocks.editor.mockClear();
    const extracted = renderToStaticMarkup(
      createElement(CaseCommercialPackageWorkbench, { value: ready }),
    );

    expect(extracted).toBe(legacy);
    expect(mocks.editor).toHaveBeenCalledWith(ready.editor);
  });
});
