// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
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
    at: `2026-09-0${id}T10:00:00.000Z`,
    attachments: [],
    fallbackHref: `/admin-v2/cases/13#message-${id}`,
  };
}

const copy = {
  allLoaded: "Rodoma visa žinučių istorija",
  attachments: "Priedai",
  categoryLabels: { customer_question: "Kliento klausimas" },
  channelLabels: { email: "El. paštas", phone: "Telefonas" },
  customerPortal: "Klientų portalas",
  deliveredAt: "Pristatyta",
  empty: "Žinučių nėra",
  inbound: "Nuo kliento",
  loadFailed: "Įkelti nepavyko",
  loadingOlder: "Įkeliamos senesnės žinutės",
  of: "iš",
  openThread: "Atverti susijusį įrašą",
  otherCategory: "Kita žinutės rūšis",
  otherChannel: "Kitas kanalas",
  otherStatus: "Kita žinutės būsena",
  outbound: "Klientui",
  rawCategory: "Neapdorota žinutės kategorija",
  rawChannel: "Neapdorotas kanalas",
  rawDirection: "Neapdorota kryptis",
  rawStatus: "Neapdorota būsena",
  recordId: "Įrašo ID",
  replyTo: "Atsakymas į žinutę",
  sentAt: "Išsiųsta",
  showOlder: "Rodyti ankstesnes žinutes",
  statusLabels: {
    contacted: "Susisiekta",
    delivered: "Pristatyta",
    failed: "Nepavyko",
  },
  technicalDetails: "Techninės detalės",
  title: "Žinutės",
};

describe("Admin Next paginated customer communications", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("loads older pages explicitly and finishes without an endless page", async () => {
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

    expect(container.textContent).toContain("Žinutės · 1 iš 3");
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
    expect(container.textContent).toContain("Žinutės · 2 iš 3");
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
    expect(container.textContent).toContain("Žinutės · 3 iš 3");
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

    expect(container.textContent).toContain("Žinutės · 25 iš 27");
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
  });

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
});
