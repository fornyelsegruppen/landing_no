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
  it("localizes source access and every freshness state", () => {
    const configurationRequired = render(
      {
        ...status,
        sources: {
          ...status.sources,
          searchConsole: {
            access: "configuration_required",
            freshness: "no-data",
            lastSuccessAt: null,
          },
        },
      },
      "lt",
    );
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

    expect(configurationRequired).toContain(
      "Reikalinga konfigūracija · Nėra duomenų",
    );
    expect(configurationRequired).toContain("Nepatvirtinta · Nežinoma");
    expect(paused).toContain("satt på pause");
    expect(paused).toContain("Verifisert · Ingen data");
    expect(paused).toContain("Menneskelig godkjenning");

    const freshnessByLocale = {
      nb: {
        unknown: "Ukjent",
        stale: "Utdatert",
        fresh: "Oppdatert",
        "no-data": "Ingen data",
      },
      lt: {
        unknown: "Nežinoma",
        stale: "Pasenę",
        fresh: "Švieži",
        "no-data": "Nėra duomenų",
      },
      en: {
        unknown: "Unknown",
        stale: "Stale",
        fresh: "Fresh",
        "no-data": "No data",
      },
    } as const;
    for (const [locale, labels] of Object.entries(freshnessByLocale) as Array<
      [
        "nb" | "lt" | "en",
        Record<"unknown" | "stale" | "fresh" | "no-data", string>,
      ]
    >) {
      for (const [freshness, label] of Object.entries(labels)) {
        expect(
          render(
            {
              ...status,
              sources: {
                ...status.sources,
                searchConsole: {
                  ...status.sources.searchConsole,
                  freshness:
                    freshness as BlogAutomationStatusDto["sources"]["searchConsole"]["freshness"],
                },
              },
            },
            locale,
          ),
        ).toContain(label);
      }
    }
  });

  it("shows a prior matching success after a failed access check without raw errors", () => {
    const failed = render(
      {
        ...status,
        lastRun: {
          id: 42,
          status: "failed",
          startedAt: "2026-09-13T08:00:00.000Z",
          finishedAt: "2026-09-13T08:00:02.000Z",
          errorCode: "provider-secret-detail",
        },
        sources: {
          ...status.sources,
          searchConsole: {
            access: "failed",
            freshness: "fresh",
            lastSuccessAt: "2026-09-12T08:00:00.000Z",
          },
        },
      },
      "en",
    );

    expect(failed).toContain("Check failed · Fresh");
    expect(failed).toContain("Last successful update");
    expect(failed).toContain("Failed · #42");
    expect(failed).toContain("The run needs manual review.");
    expect(failed).not.toContain("provider-secret-detail");
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
    expect(
      parseBlogAutomationStatus({ ...status, pendingApprovalCount: -1 }),
    ).toBeNull();
    expect(
      parseBlogAutomationStatus({ ...status, pendingApprovalCount: Infinity }),
    ).toBeNull();
    expect(
      parseBlogAutomationStatus({
        ...status,
        nextConfiguredRunAt: "not-a-date",
      }),
    ).toBeNull();
    expect(
      parseBlogAutomationStatus({
        ...status,
        sources: {
          ...status.sources,
          searchConsole: {
            ...status.sources.searchConsole,
            lastSuccessAt: "not-a-date",
          },
        },
      }),
    ).toBeNull();
    expect(
      parseBlogAutomationStatus({
        ...status,
        lastRun: {
          id: 1,
          status: "completed",
          startedAt: "not-a-date",
          finishedAt: null,
          errorCode: null,
        },
      }),
    ).toBeNull();
    expect(
      render({ ...status, nextConfiguredRunAt: "not-a-date" }, "en"),
    ).toContain("Unavailable");
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
    expect(okFetch).toHaveBeenCalledWith(
      "/api/admin/blog/automation",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("times out a single status request and propagates the loader cleanup abort", async () => {
    const pendingFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            {
              once: true,
            },
          );
        }),
    ) as unknown as typeof fetch;
    await expect(
      fetchBlogAutomationStatus(pendingFetch, { timeoutMs: 1 }),
    ).resolves.toBeNull();
    expect(pendingFetch).toHaveBeenCalledTimes(1);

    const unmountController = new AbortController();
    const unmountRequest = fetchBlogAutomationStatus(pendingFetch, {
      signal: unmountController.signal,
      timeoutMs: 1_000,
    });
    unmountController.abort();
    await expect(unmountRequest).resolves.toBeNull();
    expect(pendingFetch).toHaveBeenCalledTimes(2);
  });
});
