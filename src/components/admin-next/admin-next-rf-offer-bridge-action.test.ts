import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin-next/review-and-commit", () => ({
  ReviewAndCommit: ({ open, title }: { open: boolean; title: string }) =>
    open ? createElement("div", { "data-review-and-commit": true }, title) : null,
}));

import { AdminNextRfOfferBridgeAction } from "./admin-next-rf-offer-bridge-action";

describe("AdminNextRfOfferBridgeAction", () => {
  it("renders the explicit Preview offer action without claiming a send", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRfOfferBridgeAction, {
        addressRevision: 3,
        caseId: "lead:12",
        caseRevision: 8,
        locale: "lt",
        snapshot: {
          snapshotId: "roof-case-12-r2",
          revision: 2,
          snapshotHash: "a".repeat(64),
          inputHash: "b".repeat(64),
          renderHash: "c".repeat(64),
        },
      }),
    );

    expect(html).toContain("Įkelti matavimą į pasiūlymą");
    expect(html).not.toContain("siųsti klientui");
    expect(html).toContain('data-rf-offer-bridge="open-review"');
  });
});
