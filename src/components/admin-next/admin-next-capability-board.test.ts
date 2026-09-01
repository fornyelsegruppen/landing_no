import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import {
  AdminNextCapabilityBoard,
  AdminNextPreviewNotice,
} from "./admin-next-capability-board";

describe("Admin Next capability UI", () => {
  it("does not change the current shell while rollout is off", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextPreviewNotice, {
        locale: "lt",
        rollout: buildAdminNextRolloutView({}),
      }),
    );

    expect(html).toBe("");
  });

  it("exposes a protected preview from the shell only when enabled", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextPreviewNotice, {
        locale: "lt",
        rollout: buildAdminNextRolloutView({
          ADMIN_NEXT_MODE: "preview",
          VERCEL_ENV: "preview",
        }),
      }),
    );

    expect(html).toContain("/admin-next-preview/today");
    expect(html).toContain("Apsaugota peržiūra");
  });

  it("renders every module state with a working legacy fallback", () => {
    const rollout = buildAdminNextRolloutView({
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
      FEATURE_ADMIN_EXCEPTION_FLOWS_V2: "true",
    });
    const html = renderToStaticMarkup(
      createElement(AdminNextCapabilityBoard, { locale: "lt", rollout }),
    );

    expect(html).toContain("Šiandien");
    expect(html).toContain("Bylos apžvalga");
    expect(html).toContain("Stogo matavimas ir R4");
    expect(html).toContain("Dokumentų paketas ir preflight");
    expect(html).toContain("Darbuotojo vizitas");
    expect(html.match(/Naudoti dabartinę funkciją/g)).toHaveLength(5);
    expect(html).toContain('data-capability-state="preview_ready"');
    expect(html).toContain('data-capability-state="planned"');
  });
});
