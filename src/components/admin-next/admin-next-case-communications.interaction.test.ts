// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminNextCaseCommunications } from "./admin-next-case-communications";
import type { AdminNextCaseCommunication } from "@/lib/admin-next/case-workspace-contract";

function communication(id: number): AdminNextCaseCommunication {
  return {
    id: `message-${id}`,
    direction: id % 2 ? "inbound" : "outbound",
    channel: "email",
    category: "customer_question",
    status: "delivered",
    subject: `Message ${id}`,
    bodyText: `Body ${id}`,
    at: new Date(Date.UTC(2026, 8, 1, 10, id)).toISOString(),
    attachments: [],
    fallbackHref: `/admin-v2/cases/13#message-${id}`,
  };
}

const copy = {
  allCategories: "Visos žinučių rūšys",
  allLoaded: "Rodoma visa žinučių istorija",
  allStatuses: "Visos būsenos",
  attachments: "Priedai",
  categoryLabels: {
    customer_question: "Kliento klausimas",
    follow_up: "Tolesnis susisiekimas",
    quote: "Pasiūlymas",
  },
  channelLabels: { email: "El. paštas", phone: "Telefonas" },
  customerPortal: "Klientų portalas",
  deliveredAt: "Pristatyta",
  documentsView: "Dokumentai",
  empty: "Žinučių nėra",
  filters: "Paieška ir filtrai",
  fullHistoryView: "Visa žinučių istorija",
  historyViews: "Kliento dialogo vaizdai",
  inbound: "Nuo kliento",
  loadFailed: "Įkelti nepavyko",
  loadingOlder: "Įkeliamos senesnės žinutės",
  noMatches: "Atitikmenų nėra",
  of: "iš",
  openThread: "Atverti susijusį įrašą",
  otherCategory: "Kita žinutės rūšis",
  otherChannel: "Kitas kanalas",
  otherStatus: "Kita žinutės būsena",
  outbound: "Klientui",
  quoteContractView: "Pasiūlymai ir sutartys",
  rawCategory: "Neapdorota žinutės kategorija",
  rawChannel: "Neapdorotas kanalas",
  rawDirection: "Neapdorota kryptis",
  rawStatus: "Neapdorota būsena",
  recordId: "Įrašo ID",
  recentHistoryView: "Naujausios žinutės",
  replyTo: "Atsakymas į žinutę",
  search: "Ieškoti įkeltose žinutėse",
  searchPlaceholder: "Tema, turinys arba failo pavadinimas",
  sentAt: "Išsiųsta",
  showOlder: "Rodyti ankstesnes žinutes",
  statusFilter: "Būsena",
  statusLabels: {
    contacted: "Susisiekta",
    delivered: "Pristatyta",
    failed: "Nepavyko",
    received: "Gauta",
  },
  technicalDetails: "Techninės detalės",
  title: "Žinutės",
  typeFilter: "Žinutės rūšis",
};

describe("Admin Next paginated customer communications", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState(
      null,
      "",
      "/admin-next-preview/cases/TF-13#case-recent-communications",
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  it.each([0, 1, 27, 100])(
    "keeps the default %i-message state to at most five recent rows",
    (count) => {
      const html = renderToStaticMarkup(
        createElement(AdminNextCaseCommunications, {
          copy,
          initialItems: Array.from({ length: count }, (_, index) =>
            communication(index + 1),
          ),
          initialPageInfo: {
            totalCount: count,
            remainingCount: 0,
            nextCursor: null,
            loadMoreHref: null,
          },
          locale: "lt",
        }),
      );

      expect(html.match(/data-customer-message=/gu) || []).toHaveLength(
        Math.min(count, 5),
      );
      expect(html).toContain('data-communication-history-mode="recent"');
      expect(html).not.toContain("data-communication-history-filters");
    },
  );

  it("exposes every loaded record in full mode with usable search, type and status filters", async () => {
    window.history.replaceState(
      null,
      "",
      "/admin-next-preview/cases/TF-13#case-communications-history",
    );
    const items = [
      { ...communication(1), status: "received" },
      { ...communication(2), category: "quote" },
      { ...communication(3), category: "follow_up", status: "failed" },
      ...Array.from({ length: 24 }, (_, index) => communication(index + 4)),
    ];

    await act(async () => {
      root.render(
        createElement(AdminNextCaseCommunications, {
          copy,
          initialItems: items,
          locale: "lt",
        }),
      );
    });

    expect(container.querySelectorAll("[data-customer-message]")).toHaveLength(
      27,
    );
    expect(container.textContent).toContain("Visa žinučių istorija · 27 iš 27");
    const filters = container.querySelector(
      "[data-communication-history-filters]",
    );
    const input = filters?.querySelector("input") as HTMLInputElement;
    const selects = filters?.querySelectorAll("select");
    const typeSelect = selects?.[0] as HTMLSelectElement;
    const statusSelect = selects?.[1] as HTMLSelectElement;
    const setInputValue = (value: string) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    await act(async () => {
      setInputValue("Message 17");
    });
    expect(container.querySelectorAll("[data-customer-message]")).toHaveLength(
      1,
    );
    expect(container.textContent).toContain("Message 17");

    await act(async () => {
      setInputValue("");
      typeSelect.value = "quote";
      typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelectorAll("[data-customer-message]")).toHaveLength(
      1,
    );
    expect(container.textContent).toContain("Message 2");

    await act(async () => {
      typeSelect.value = "all";
      typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      statusSelect.value = "failed";
      statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelectorAll("[data-customer-message]")).toHaveLength(
      1,
    );
    expect(container.textContent).toContain("Message 3");
  });

  it("keeps recent/full selection in the hash and restores it with browser Back", async () => {
    await act(async () => {
      root.render(
        createElement(AdminNextCaseCommunications, {
          copy,
          initialItems: Array.from({ length: 10 }, (_, index) =>
            communication(index + 1),
          ),
          locale: "lt",
        }),
      );
    });

    const fullLink = container.querySelector(
      'a[href="#case-communications-history"]',
    ) as HTMLAnchorElement;
    fullLink.focus();
    await act(async () => {
      fullLink.click();
      await Promise.resolve();
    });

    expect(window.location.hash).toBe("#case-communications-history");
    expect(
      container
        .querySelector("[data-communication-history-mode]")
        ?.getAttribute("data-communication-history-mode"),
    ).toBe("full");
    expect(container.querySelectorAll("[data-customer-message]")).toHaveLength(
      10,
    );
    expect(document.activeElement).toBe(fullLink);

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(window.location.hash).toBe("#case-recent-communications");
    expect(
      container
        .querySelector("[data-communication-history-mode]")
        ?.getAttribute("data-communication-history-mode"),
    ).toBe("recent");
    expect(container.querySelectorAll("[data-customer-message]")).toHaveLength(
      5,
    );
    expect(
      container
        .querySelector('a[href="#case-recent-communications"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("loads older pages explicitly and finishes without an endless page", async () => {
    window.history.replaceState(
      null,
      "",
      "/admin-next-preview/cases/TF-13#case-communications-history",
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [communication(2)],
            pageInfo: {
              totalCount: 3,
              remainingCount: 1,
              nextCursor: "cursor-2",
              loadMoreHref: "/api/admin-next/cases/13/communications",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [communication(1)],
            pageInfo: {
              totalCount: 3,
              remainingCount: 0,
              nextCursor: null,
              loadMoreHref: "/api/admin-next/cases/13/communications",
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        createElement(AdminNextCaseCommunications, {
          copy,
          initialItems: [communication(3)],
          initialPageInfo: {
            totalCount: 3,
            remainingCount: 2,
            nextCursor: "cursor-3",
            loadMoreHref: "/api/admin-next/cases/13/communications",
          },
          locale: "lt",
        }),
      );
    });

    expect(container.textContent).toContain("Visa žinučių istorija · 1 iš 3");
    expect(container.textContent).toContain("Rodyti ankstesnes žinutes (2)");
    expect(
      container.querySelector("[data-customer-communications]")?.className,
    ).not.toMatch(/max-h|overflow/u);
    expect(container.querySelectorAll("[data-customer-message]")).toHaveLength(
      1,
    );
    expect(
      container.querySelector("[data-customer-message]")?.hasAttribute("open"),
    ).toBe(false);
    expect(
      container
        .querySelector("[data-message-technical-diagnostics]")
        ?.hasAttribute("open"),
    ).toBe(false);
    expect(container.textContent).toContain("Klientų portalas");
    expect(container.textContent).toContain("Kliento klausimas");

    await act(async () => {
      (
        container.querySelector(
          "[data-load-older-communications]",
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin-next/cases/13/communications?cursor=cursor-3",
      { cache: "no-store", credentials: "same-origin" },
    );
    expect(container.textContent).toContain("Visa žinučių istorija · 2 iš 3");
    expect(container.textContent).toContain("Rodyti ankstesnes žinutes (1)");

    await act(async () => {
      (
        container.querySelector(
          "[data-load-older-communications]",
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin-next/cases/13/communications?cursor=cursor-2",
      { cache: "no-store", credentials: "same-origin" },
    );
    expect(container.textContent).toContain("Visa žinučių istorija · 3 iš 3");
    expect(container.textContent).toContain("Rodoma visa žinučių istorija");
    expect(
      container.querySelector("[data-load-older-communications]"),
    ).toBeNull();
    const completion = container.querySelector(
      "[data-communication-history-complete]",
    );
    expect(completion?.getAttribute("aria-live")).toBe("polite");
    expect(completion?.getAttribute("role")).toBe("status");
    expect(document.activeElement).toBe(completion);
    expect(container.textContent).toContain("Message 3");
    expect(container.textContent).toContain("Message 2");
    expect(container.textContent).toContain("Message 1");
  });

  it("keeps the frozen 25 of 27 history bounded behind one explicit load control", async () => {
    window.history.replaceState(
      null,
      "",
      "/admin-next-preview/cases/TF-13#case-communications-history",
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [communication(26), communication(27)],
          pageInfo: {
            totalCount: 27,
            remainingCount: 0,
            nextCursor: null,
            loadMoreHref: "/api/admin-next/cases/13/communications",
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      root.render(
        createElement(AdminNextCaseCommunications, {
          copy,
          initialItems: Array.from({ length: 25 }, (_, index) =>
            communication(index + 1),
          ),
          initialPageInfo: {
            totalCount: 27,
            remainingCount: 2,
            nextCursor: "cursor-25",
            loadMoreHref: "/api/admin-next/cases/13/communications",
          },
          locale: "lt",
        }),
      );
    });

    expect(container.textContent).toContain("Visa žinučių istorija · 25 iš 27");
    expect(container.textContent).toContain("Rodyti ankstesnes žinutes (2)");
    expect(container.querySelectorAll("[data-customer-message]")).toHaveLength(
      25,
    );
    expect(
      container.querySelector("[data-customer-communications]")?.className,
    ).not.toMatch(/max-h|overflow/u);
    expect(
      container.querySelectorAll("[data-load-older-communications]"),
    ).toHaveLength(1);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-load-older-communications]")
        ?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin-next/cases/13/communications?cursor=cursor-25",
      { cache: "no-store", credentials: "same-origin" },
    );
    expect(container.querySelectorAll("[data-customer-message]")).toHaveLength(
      27,
    );
    expect(container.textContent).toContain("Visa žinučių istorija · 27 iš 27");
    expect(
      container.querySelector("[data-load-older-communications]"),
    ).toBeNull();
  });

  it("loads a 100-message history in explicit 25-message pages", async () => {
    window.history.replaceState(
      null,
      "",
      "/admin-next-preview/cases/TF-13#case-communications-history",
    );
    const page = (
      start: number,
      remainingCount: number,
      nextCursor: string | null,
    ) =>
      new Response(
        JSON.stringify({
          items: Array.from({ length: 25 }, (_, index) =>
            communication(start + index),
          ),
          pageInfo: {
            totalCount: 100,
            remainingCount,
            nextCursor,
            loadMoreHref: "/api/admin-next/cases/13/communications",
          },
        }),
        { status: 200 },
      );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(26, 50, "cursor-50"))
      .mockResolvedValueOnce(page(51, 25, "cursor-75"))
      .mockResolvedValueOnce(page(76, 0, null));
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        createElement(AdminNextCaseCommunications, {
          copy,
          initialItems: Array.from({ length: 25 }, (_, index) =>
            communication(index + 1),
          ),
          initialPageInfo: {
            totalCount: 100,
            remainingCount: 75,
            nextCursor: "cursor-25",
            loadMoreHref: "/api/admin-next/cases/13/communications",
          },
          locale: "lt",
        }),
      );
    });

    for (const expectedLoaded of [50, 75, 100]) {
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>("[data-load-older-communications]")
          ?.click();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(
        container.querySelectorAll("[data-customer-message]"),
      ).toHaveLength(expectedLoaded);
      expect(container.textContent).toContain(
        `Visa žinučių istorija · ${expectedLoaded} iš 100`,
      );
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      container.querySelector("[data-load-older-communications]"),
    ).toBeNull();
    expect(
      container.querySelector("[data-communication-history-complete]"),
    ).not.toBeNull();
  }, 15_000);

  it("shows the exact historical recipient, delivery failure and manual recovery", async () => {
    const failed: AdminNextCaseCommunication = {
      ...communication(2),
      direction: "outbound",
      status: "failed",
      delivery: {
        approvedAt: "2026-09-02T09:55:00.000Z",
        queuedAt: "2026-09-02T09:56:00.000Z",
        recipient: "customer@example.no",
        provider: "resend",
        failureCode: "provider_timeout",
        failureMessage: "Delivery confirmation timed out",
        manualRecovery: {
          channel: "phone",
          status: "contacted",
          preparedAt: "2026-09-02T10:10:00.000Z",
          contactedAt: "2026-09-02T10:20:00.000Z",
        },
      },
    };

    await act(async () => {
      root.render(
        createElement(AdminNextCaseCommunications, {
          copy,
          initialItems: [failed],
          locale: "lt",
        }),
      );
    });

    expect(container.textContent).toContain("Pristatymo eiga");
    expect(container.textContent).toContain("Istorinis gavėjas");
    expect(container.textContent).toContain("customer@example.no");
    expect(container.textContent).toContain("Pristatymo klaida");
    expect(container.textContent).toContain("provider_timeout");
    expect(container.textContent).toContain("Rankinis susisiekimas");
    expect(container.textContent).toContain("Su klientu susisiekta");
    expect(container.querySelectorAll("[data-delivery-stage]")).toHaveLength(4);
  });

  it("shows queued provider acceptance as unreconciled instead of ordinary sent", async () => {
    const ambiguous: AdminNextCaseCommunication = {
      ...communication(28),
      direction: "outbound",
      category: "receipt",
      status: "queued",
      sentAt: "2026-09-05T06:48:00.000Z",
      deliveredAt: undefined,
      delivery: {
        provider: "resend",
        providerMessageId: "resend-message-28",
        failureCode: "Error",
        failureMessage: "Application finalization failed",
        reconciliationState: "provider_accepted_unreconciled",
      },
    };

    await act(async () => {
      root.render(
        createElement(AdminNextCaseCommunications, {
          copy,
          initialItems: [ambiguous],
          locale: "lt",
        }),
      );
    });

    expect(
      container.querySelector(
        '[data-message-reconciliation="provider_accepted_unreconciled"]',
      )?.textContent,
    ).toContain("Būsena neaiški");
    expect(container.textContent).toContain(
      "Prieš galimą pakartotinį siuntimą suderinkite teikėjo žurnalą",
    );
    expect(container.textContent).toContain("resend-message-28");
    expect(container.textContent).toContain(
      "Užregistruotas sentAt (ne pristatymo patvirtinimas)",
    );
    const sentStage = container.querySelector('[data-delivery-stage="sent"]');
    expect(sentStage?.getAttribute("data-delivery-stage-state")).toBe(
      "unreconciled",
    );
    expect(sentStage?.className).not.toContain("--an-success");
    expect(container.textContent).not.toContain("pakartotinai išsiųsta");
  });
});
