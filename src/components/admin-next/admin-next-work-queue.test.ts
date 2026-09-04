import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  adminNextWorkQueueHref,
  adminNextWorkQueueNextPageHref,
  AdminNextWorkQueue,
  parseAdminNextWorkQueueRouteState,
  workQueueExactActionHref,
  workQueueFilterOptionsFromFacets,
} from "./admin-next-work-queue";
import {
  createWorkQueuePage,
  parseCanonicalWorkQueueQuery,
  parseWorkQueueCursor,
  type WorkQueuePage,
} from "@/lib/admin-next/work-queue-contract";
import { createAdminNextWorkQueueFixture } from "@/lib/admin-next/work-queue-fixture";
import type { PanelLocale } from "@/lib/panel-i18n";

function query(value = "view=today&queue=all&limit=25") {
  const parsed = parseCanonicalWorkQueueQuery(value);
  if (!parsed.ok) throw new Error(`Invalid test query: ${parsed.code}`);
  return parsed.value;
}

function renderQueue(locale: PanelLocale, selectedCaseId?: string) {
  const page = createAdminNextWorkQueueFixture(locale, query());
  return renderPage(locale, page, selectedCaseId);
}

function renderPage(
  locale: PanelLocale,
  page: WorkQueuePage,
  selectedCaseId?: string,
) {
  const filterOptions = workQueueFilterOptionsFromFacets(page, locale);
  return renderToStaticMarkup(
    createElement(AdminNextWorkQueue, {
      actionKinds: filterOptions.actionKinds,
      basePath: "/admin-next-work-queue-fixture",
      filterOwners: filterOptions.filterOwners,
      locale,
      page,
      processStages: filterOptions.processStages,
      selectedCaseId,
    }),
  );
}

function nextPageAnchor(html: string) {
  const anchor = html.match(/<a[^>]*data-work-queue-next-page[^>]*>/u)?.[0];
  if (!anchor) return null;
  const href = anchor.match(/href="([^"]+)"/u)?.[1].replaceAll("&amp;", "&");
  return { anchor, href: href || null };
}

describe("Admin Next Work Queue", () => {
  it("renders the synthetic fixture as shadow-read without an action link", () => {
    const html = renderQueue("en", "case:1042");

    expect(html).toContain('data-work-queue-interaction="read_only"');
    expect(html).not.toContain("data-work-queue-action");
    expect(html).not.toMatch(/[?&](?:focus|target)=/u);
  });

  it("keeps every synthetic fixture item non-executable", () => {
    const page = createAdminNextWorkQueueFixture("en", query());
    const executable = page.items.filter(
      (item) => item.interaction.mode === "executable",
    );

    expect(executable).toHaveLength(0);
    expect(
      page.items.every((item) => item.sourceTruth.kind === "shadow_read"),
    ).toBe(true);
    expect(
      page.items.every((item) => workQueueExactActionHref(item) === null),
    ).toBe(true);
  });

  it("offers no action CTA for waiting and read-only details", () => {
    const waiting = renderQueue("lt", "case:1031");
    const readOnly = renderQueue("lt", "case:1027");

    expect(waiting).toContain('data-work-queue-interaction="waiting"');
    expect(waiting).toContain("Kitas žingsnis priklauso kitai šaliai");
    expect(waiting).not.toContain("data-work-queue-action");
    expect(readOnly).toContain('data-work-queue-interaction="read_only"');
    expect(readOnly).toContain(
      "Šaltinis yra kontroliuojamas šešėlinis skaitymas",
    );
    expect(readOnly).not.toContain("data-work-queue-action");
  });

  it("fails closed when selected is unknown or hidden by the current page", () => {
    const html = renderQueue("en", "case:not-visible");

    expect(html).toContain('data-work-queue-detail="none"');
    expect(html).toContain("data-work-queue-empty-detail");
    expect(html).toContain("No detail or action is shown");
    expect(html).not.toContain("data-work-queue-detail-content");
    expect(html).not.toContain("data-work-queue-action");
  });

  it("resets cursor and selected when a queue filter changes", () => {
    const cursor = parseWorkQueueCursor("wq1_MDEyMzQ1Njc4OWFiY2RlZg");
    const href = adminNextWorkQueueHref({
      basePath: "/admin-next-preview/work",
      query: {
        ...query("view=today&queue=all&stage=work&limit=25"),
        cursor,
      },
      queue: "waiting",
      selectedCaseId: null,
    });
    const url = new URL(href, "https://example.test");

    expect(url.pathname).toBe("/admin-next-preview/work");
    expect(url.searchParams.get("queue")).toBe("waiting");
    expect(url.searchParams.get("stage")).toBe("work");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.has("selected")).toBe(false);
    expect([...url.searchParams.keys()]).toEqual([
      "view",
      "queue",
      "stage",
      "limit",
    ]);
  });

  it.each([
    ["nb", "Neste side"],
    ["lt", "Kitas puslapis"],
    ["en", "Next page"],
  ] as const)(
    "renders a localized native Next link in %s from pageInfo.nextCursor only",
    (locale, label) => {
      const currentQuery = query(
        "view=today&queue=blocked&stage=commercial&action=calculate_price&ownerId=admin%3Ademo&limit=10",
      );
      const basePage = createAdminNextWorkQueueFixture(locale, currentQuery);
      const nextCursor = parseWorkQueueCursor("wq1_cGFnZS0yLXNuYXBzaG90LTAx");
      const page = createWorkQueuePage({
        items: basePage.items,
        nextCursor,
        query: currentQuery,
      });
      const html = renderPage(locale, page, "case:1027");
      const link = nextPageAnchor(html);

      expect(link).not.toBeNull();
      expect(link?.anchor).toContain(`aria-label="${label}"`);
      expect(link?.anchor.startsWith("<a")).toBe(true);
      expect(link?.anchor).not.toContain("<button");
      expect(html).toContain(`>${label}<`);
      const url = new URL(link?.href || "", "https://example.test");
      expect(url.pathname).toBe("/admin-next-work-queue-fixture");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        action: "calculate_price",
        cursor: nextCursor,
        limit: "10",
        ownerId: "admin:demo",
        queue: "blocked",
        stage: "commercial",
        view: "today",
      });
      expect(url.searchParams.has("selected")).toBe(false);
      expect(url.searchParams.has("offset")).toBe(false);
      expect(
        adminNextWorkQueueNextPageHref({
          basePath: "/admin-next-preview/work",
          page,
        }),
      ).toContain(`cursor=${nextCursor}`);
    },
  );

  it.each([
    [
      "nb",
      "Forrige side: bruk Tilbake-knappen i nettleseren.",
      "Ingen flere saker i denne visningen.",
    ],
    [
      "lt",
      "Ankstesnis puslapis: naudokite naršyklės mygtuką „Atgal“.",
      "Šiame vaizde daugiau bylų nėra.",
    ],
    [
      "en",
      "Previous page: use your browser’s Back button.",
      "No more cases in this view.",
    ],
  ] as const)(
    "uses browser Back for the previous %s page and renders no false Next",
    (locale, backGuidance, endLabel) => {
      const currentCursor = parseWorkQueueCursor("wq1_Y3VycmVudC1wYWdlLTAwMDE");
      const currentQuery = {
        ...query(),
        cursor: currentCursor,
      };
      const page = createWorkQueuePage({
        items: [],
        nextCursor: null,
        query: currentQuery,
      });
      const html = renderPage(locale, page);

      expect(html).toContain("data-work-queue-browser-back-guidance");
      expect(html).toContain(backGuidance);
      expect(html).toContain("data-work-queue-end");
      expect(html).toContain(endLabel);
      expect(nextPageAnchor(html)).toBeNull();
      expect(
        adminNextWorkQueueNextPageHref({
          basePath: "/admin-next-preview/work",
          page,
        }),
      ).toBeNull();
    },
  );

  it("renders no pagination control for an empty first page without a continuation cursor", () => {
    const page = createWorkQueuePage({
      items: [],
      nextCursor: null,
      query: query(),
    });
    const html = renderPage("en", page);

    expect(html).not.toContain("data-work-queue-pagination");
    expect(html).not.toContain("data-work-queue-next-page");
  });

  it("uses a complete 3 by 2 queue grid below the small breakpoint", () => {
    const html = renderQueue("lt", "case:1042");

    expect(html).toContain("data-work-queue-view-filter");
    expect(html).toContain("grid-cols-3");
    expect(html).toContain("sm:flex");
    expect(html).toContain("whitespace-normal");
    for (const label of [
      "Visos",
      "Mano",
      "Vėluoja",
      "Laukia",
      "Užblokuota",
      "Nepriskirta",
    ]) {
      expect(html).toContain(`>${label}</a>`);
    }
  });

  it.each([
    ["nb", "Hvorfor nå", "Fristen er passert."],
    ["lt", "Kodėl dabar", "Terminas jau praėjo."],
    ["en", "Why now", "The deadline has passed."],
  ] as const)(
    "explains priority dimensions without exposing reason codes in %s",
    (locale, whyNow, reason) => {
      const page = createAdminNextWorkQueueFixture(locale, query());
      const html = renderPage(locale, page, "case:1042");

      expect(html).toContain(`>${whyNow}:</strong>`);
      expect(html).toContain(reason);
      expect(html.match(/data-work-queue-priority=/gu)).toHaveLength(
        page.items.length,
      );
      expect(html.match(/data-work-queue-priority-dimensions/gu)).toHaveLength(
        page.items.length,
      );
      expect(html).not.toContain(">OVERDUE<");
    },
  );

  it("uses totalItems for the result count and pre-pagination facets for filters", () => {
    const basePage = createAdminNextWorkQueueFixture("en", query());
    const page = createWorkQueuePage({
      facets: basePage.facets,
      items: [basePage.items[0]],
      nextCursor: null,
      query: basePage.query,
      totalItems: basePage.totalItems,
    });
    const options = workQueueFilterOptionsFromFacets(page, "en");
    const html = renderPage("en", page);

    expect(html).toContain(
      `<strong class="text-[var(--an-text-primary)]">${basePage.totalItems}</strong>`,
    );
    expect(options.actionKinds).toContain("calculate_price");
    expect(options.processStages).toContain("work");
    expect(options.filterOwners).toContainEqual({
      id: "customer:1031",
      label: "Customer · customer:1031",
    });
    expect(html).toContain('<option value="calculate_price">');
  });

  it("keeps only valid canonical query fields around the UI selection", () => {
    const state = parseAdminNextWorkQueueRouteState(
      {
        action: "",
        lang: "lt",
        limit: "25",
        ownerId: "",
        queue: "mine",
        selected: "case:1042",
        stage: "",
        view: "today",
      },
      ["lang"],
    );

    expect(state.parsed).toMatchObject({
      ok: true,
      value: {
        actionKind: null,
        cursor: null,
        ownerId: null,
        processStage: null,
        queue: "mine",
      },
    });
    expect(state.needsCanonicalRedirect).toBe(true);
    expect(state.selectedCaseId).toBe("case:1042");
    expect(
      parseAdminNextWorkQueueRouteState({
        limit: "25",
        queue: "all",
        surprise: "1",
        view: "today",
      }).parsed,
    ).toMatchObject({ ok: false, code: "UNKNOWN_QUERY_KEY" });
  });

  it.each([
    "",
    "case:0",
    "case:01",
    "case:-1",
    "case:not-a-number",
    "case:9007199254740992",
  ])("canonicalizes an invalid selected value %j away", (selected) => {
    const state = parseAdminNextWorkQueueRouteState({
      limit: "25",
      queue: "all",
      selected,
      view: "today",
    });

    expect(state.parsed.ok).toBe(true);
    expect(state.selectedCaseId).toBeNull();
    expect(state.needsCanonicalRedirect).toBe(true);
  });

  it.each([
    ["nb", "Arbeidskø", "Venter", "Kun lesing"],
    ["lt", "Darbo eilė", "Laukiama", "Tik skaityti"],
    ["en", "Work queue", "Waiting", "Read only"],
  ] as const)(
    "renders localized queue and interaction states in %s",
    (locale, title, waiting, readOnly) => {
      const html = renderQueue(locale, "case:1042");
      expect(html).toContain(`>${title}</h1>`);
      expect(html).toContain(waiting);
      expect(html).toContain(readOnly);
    },
  );
});
