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
  deliveredAt: "Pristatyta",
  empty: "Žinučių nėra",
  inbound: "Nuo kliento",
  loadFailed: "Įkelti nepavyko",
  loadingOlder: "Įkeliamos senesnės žinutės",
  of: "iš",
  openThread: "Atidaryti Admin V2",
  outbound: "Klientui",
  replyTo: "Atsakymas į žinutę",
  sentAt: "Išsiųsta",
  showOlder: "Rodyti ankstesnes žinutes",
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
    ).toContain("max-h-[42rem]");

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
    expect(container.textContent).toContain("Message 3");
    expect(container.textContent).toContain("Message 2");
    expect(container.textContent).toContain("Message 1");
  });
});
