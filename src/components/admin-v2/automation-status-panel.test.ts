import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AutomationStatusPanel,
  fetchBlogAutomationStatus,
  parseBlogAutomationStatus,
  type BlogAutomationStatusDto,
} from "./automation-status-panel";

const status: BlogAutomationStatusDto = {
  features: { draftsEnabled: true, approvedPublisherEnabled: false },
  executor: { state: "unknown", verifiedAt: null, targetMatches: null },
  timeZone: "Europe/Oslo",
  lastRun: null,
  nextConfiguredRunAt: "2026-09-14T07:00:00.000Z",
  pendingApprovalCount: 3,
  sources: {
    searchConsole: {
      access: "verified",
      freshness: "stale",
      lastSuccessAt: "2026-09-10T07:00:00.000Z",
    },
    trends: { access: "unverified", freshness: "unknown", lastSuccessAt: null },
  },
};

function render(data: BlogAutomationStatusDto, locale: "nb" | "en" | "lt") {
  return renderToStaticMarkup(
    createElement(AutomationStatusPanel, {
      state: { kind: "loaded", data },
      locale,
    }),
  );
}

describe("automation status panel", () => {
  it("renders paused, unknown, stale and no-data states without claiming verified execution", () => {
    const unknown = render(status, "lt");
    const paused = render(
      {
        ...status,
        executor: { state: "paused", verifiedAt: null, targetMatches: null },
        sources: {
          ...status.sources,
          searchConsole: {
            ...status.sources.searchConsole,
            freshness: "no-data",
          },
        },
      },
      "nb",
    );

    expect(unknown).toContain("vykdymas nepatvirtintas");
    expect(unknown).toContain("stale");
    expect(unknown).toContain("Teorinis laikas");
    expect(paused).toContain("satt på pause");
    expect(paused).toContain("no-data");
    expect(paused).toContain("Menneskelig godkjenning");
  });

  it("localizes unavailable and loading states", () => {
    expect(
      renderToStaticMarkup(
        createElement(AutomationStatusPanel, {
          state: { kind: "unavailable" },
          locale: "lt",
        }),
      ),
    ).toContain("nepasiekiama");
    expect(
      renderToStaticMarkup(
        createElement(AutomationStatusPanel, {
          state: { kind: "loading" },
          locale: "en",
        }),
      ),
    ).toContain("Loading automation status");
  });

  it("rejects missing or incompatible DTO fields", () => {
    expect(
      parseBlogAutomationStatus({ ...status, executor: undefined }),
    ).toBeNull();
    expect(
      parseBlogAutomationStatus({
        ...status,
        executor: { state: "verified", verifiedAt: null, targetMatches: null },
      }),
    ).toBeNull();
    expect(
      parseBlogAutomationStatus({
        ...status,
        sources: {
          ...status.sources,
          trends: {
            access: "verified",
            freshness: "fresh",
            lastSuccessAt: null,
          },
        },
      }),
    ).toBeNull();
  });

  it("loads once with private-cache semantics and fails closed on HTTP errors", async () => {
    const okFetch = vi.fn(
      async () => new Response(JSON.stringify(status), { status: 200 }),
    ) as unknown as typeof fetch;
    const errorFetch = vi.fn(
      async () => new Response(null, { status: 403 }),
    ) as unknown as typeof fetch;

    await expect(fetchBlogAutomationStatus(okFetch)).resolves.toEqual(status);
    await expect(fetchBlogAutomationStatus(errorFetch)).resolves.toBeNull();
    expect(okFetch).toHaveBeenCalledWith("/api/admin/blog/automation", {
      cache: "no-store",
      credentials: "same-origin",
    });
  });
});
