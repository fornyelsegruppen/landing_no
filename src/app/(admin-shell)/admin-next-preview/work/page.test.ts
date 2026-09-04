import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWorkQueueItem,
  createWorkQueuePage,
  parseCanonicalWorkQueueQuery,
  parseWorkQueueCursor,
  type CanonicalWorkQueueQuery,
  type WorkQueueCursor,
} from "@/lib/admin-next/work-queue-contract";
import { createAdminNextWorkQueueFixture } from "@/lib/admin-next/work-queue-fixture";

const mocks = vi.hoisted(() => ({
  adapterLoad: vi.fn(),
  createCanonical: vi.fn(),
  getPayload: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  payload: { find: vi.fn() },
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  requireAdminUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/lib/auth/internal-session", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));
vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/lib/admin-next/today-read-adapter", () => ({
  createAdminNextCanonicalTodayAdapter: mocks.createCanonical,
}));

import AdminNextPreviewWorkQueuePage from "./page";

const admin = {
  active: true,
  displayName: "Canonical operator",
  email: "operator@example.invalid",
  id: 7,
  interfaceLanguage: "lt",
  role: "admin",
} as const;

const now = new Date("2026-09-04T10:00:00.000Z");

function query(value = "view=today&queue=all&limit=25") {
  const parsed = parseCanonicalWorkQueueQuery(value);
  if (!parsed.ok) throw new Error(parsed.code);
  return parsed.value;
}

function canonicalPage(
  currentQuery: CanonicalWorkQueueQuery,
  nextCursor: WorkQueueCursor | null = null,
) {
  const item = createWorkQueueItem(
    {
      actionKind: "generate_reply",
      blockers: [],
      capabilityGranted: false,
      case: {
        href: "/admin-v2/cases/13",
        id: "case:13",
        reference: "TF-13",
        revision: 4,
      },
      interaction: { mode: "read_only", reason: "capability_denied" },
      locale: "lt",
      owner: { id: "user:7", party: "administrator" },
      sourceTruth: {
        contractVersion: "f2-v1",
        derivedAt: now.toISOString(),
        kind: "canonical",
        resolver: "deriveCaseNextAction",
      },
      target: {
        entity: "case",
        href: "/admin-v2/cases/13",
        id: "case:13",
        version: "r4",
      },
      timing: { dueAt: "2026-09-04T12:00:00.000Z", wakeAt: null },
    },
    now,
  );
  return createWorkQueuePage({
    items: [item],
    nextCursor,
    query: currentQuery,
  });
}

function renderedNextHref(html: string) {
  const anchor = html.match(/<a[^>]*data-work-queue-next-page[^>]*>/u)?.[0];
  const href = anchor?.match(/href="([^"]+)"/u)?.[1];
  return href?.replaceAll("&amp;", "&") || null;
}

describe("Admin Next Preview Work Queue route", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_NEXT_MODE", "preview");
    vi.stubEnv("FEATURE_ADMIN_EXCEPTION_FLOWS_V2", "true");
    vi.stubEnv("FEATURE_CASE_STATE_ENGINE_V2", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.requireAdminUser.mockReset().mockResolvedValue(admin);
    mocks.getPayload.mockReset().mockResolvedValue(mocks.payload);
    mocks.adapterLoad.mockReset().mockImplementation(async (currentQuery) => ({
      source: "canonical",
      status: "ready",
      value: [],
      workQueue: canonicalPage(currentQuery),
    }));
    mocks.createCanonical
      .mockReset()
      .mockReturnValue({ load: mocks.adapterLoad });
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("loads Preview from the canonical adapter with only registry-backed read capability", async () => {
    const element = await AdminNextPreviewWorkQueuePage({
      searchParams: Promise.resolve({
        limit: "25",
        queue: "all",
        view: "today",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(mocks.createCanonical).toHaveBeenCalledWith(
      mocks.payload,
      "Canonical operator",
      {
        currentUserId: "user:7",
        grantedCapabilities: ["case.read"],
        locale: "lt",
      },
    );
    expect(mocks.adapterLoad).toHaveBeenCalledWith(query());
    expect(element.props).toMatchObject({
      filterOwners: [{ id: "user:7", label: "Administratorius · user:7" }],
      source: "canonical",
    });
    expect(html).toContain("Apsaugota Preview · canonical duomenys");
    expect(html).not.toMatch(/Demo ·|sintetiniai duomenys|Kari Nilsen|Marius/u);
    expect(html).not.toContain('data-work-queue-action="exact-deep-link"');
  });

  it("uses pre-pagination facets for route filters and totalItems for the count", async () => {
    const currentQuery = query("view=today&queue=all&limit=1");
    const basePage = canonicalPage(currentQuery);
    const workQueue = createWorkQueuePage({
      facets: {
        actionKinds: [
          { count: 1, value: "generate_reply" },
          { count: 1, value: "prepare_package" },
        ],
        owners: [
          { count: 1, id: "user:7", party: "administrator" },
          { count: 1, id: "user:9", party: "administrator" },
        ],
        processStages: [
          { count: 1, value: "evidence" },
          { count: 1, value: "inquiry" },
        ],
      },
      items: basePage.items,
      nextCursor: null,
      query: currentQuery,
      totalItems: 2,
    });
    mocks.adapterLoad.mockResolvedValueOnce({
      source: "canonical",
      status: "ready",
      value: [],
      workQueue,
    });

    const element = await AdminNextPreviewWorkQueuePage({
      searchParams: Promise.resolve({
        limit: "1",
        queue: "all",
        view: "today",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(element.props.actionKinds).toEqual([
      "generate_reply",
      "prepare_package",
    ]);
    expect(element.props.processStages).toEqual(["evidence", "inquiry"]);
    expect(element.props.filterOwners).toContainEqual({
      id: "user:9",
      label: "Administratorius · user:9",
    });
    expect(html).toContain('<option value="prepare_package">');
    expect(html).toContain(
      '<strong class="text-[var(--an-text-primary)]">2</strong>',
    );
  });

  it("keeps the local development fixture explicit and never opens Payload", async () => {
    vi.stubEnv("VERCEL_ENV", "development");

    const element = await AdminNextPreviewWorkQueuePage({
      searchParams: Promise.resolve({
        limit: "25",
        queue: "all",
        view: "today",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.createCanonical).not.toHaveBeenCalled();
    expect(element.props.source).toBe("fixture");
    expect(html).toContain("Apsaugota Preview · sintetiniai duomenys");
    expect(html).not.toContain("data-work-queue-action");
    expect(html).not.toMatch(/[?&](?:focus|target)=/u);
  });

  it("passes canonical query and cursor while retaining only a valid selected case", async () => {
    const cursor = `wq1_${"a".repeat(20)}`;
    const search = {
      action: "generate_reply",
      cursor,
      limit: "10",
      ownerId: "user:7",
      queue: "mine",
      selected: "case:13",
      stage: "inquiry",
      view: "today",
    } as const;

    const element = await AdminNextPreviewWorkQueuePage({
      searchParams: Promise.resolve(search),
    });
    const expectedQuery = query(
      `view=today&queue=mine&stage=inquiry&action=generate_reply&ownerId=user%3A7&cursor=${cursor}&limit=10`,
    );

    expect(mocks.adapterLoad).toHaveBeenCalledWith(expectedQuery);
    expect(element.props.selectedCaseId).toBe("case:13");
    expect(element.props.actionKinds).toContain("generate_reply");
    expect(element.props.processStages).toContain("inquiry");
  });

  it("renders the canonical continuation cursor as a native link and resets selected", async () => {
    const nextCursor = parseWorkQueueCursor("wq1_bmV4dC1jYW5vbmljYWwtcGFnZQ");
    mocks.adapterLoad.mockImplementationOnce(async (currentQuery) => ({
      source: "canonical",
      status: "ready",
      value: [],
      workQueue: canonicalPage(currentQuery, nextCursor),
    }));

    const element = await AdminNextPreviewWorkQueuePage({
      searchParams: Promise.resolve({
        action: "generate_reply",
        limit: "10",
        ownerId: "user:7",
        queue: "mine",
        selected: "case:13",
        stage: "inquiry",
        view: "today",
      }),
    });
    const html = renderToStaticMarkup(element);
    const nextHref = renderedNextHref(html);

    expect(nextHref).not.toBeNull();
    const url = new URL(nextHref || "", "https://example.test");
    expect(url.pathname).toBe("/admin-next-preview/work");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: "generate_reply",
      cursor: nextCursor,
      limit: "10",
      ownerId: "user:7",
      queue: "mine",
      stage: "inquiry",
      view: "today",
    });
    expect(url.searchParams.has("selected")).toBe(false);
    expect(url.searchParams.has("offset")).toBe(false);
    expect(html).toContain('aria-label="Kitas puslapis"');
    expect(html).not.toContain("data-work-queue-browser-back-guidance");
  });

  it("fails closed when the canonical adapter rejects a stale or mismatched cursor", async () => {
    const staleCursor = `wq1_${"b".repeat(24)}`;
    mocks.adapterLoad.mockRejectedValueOnce(
      Object.assign(new Error("cursor snapshot mismatch"), {
        code: "INVALID_CURSOR_PAYLOAD",
      }),
    );

    const element = await AdminNextPreviewWorkQueuePage({
      searchParams: Promise.resolve({
        cursor: staleCursor,
        limit: "25",
        queue: "all",
        view: "today",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(mocks.adapterLoad).toHaveBeenCalledWith(
      query(`view=today&queue=all&cursor=${staleCursor}&limit=25`),
    );
    expect(html).toContain('data-work-queue-load-state="canonical_error"');
    expect(html).toContain('href="/admin-v2"');
    expect(html).not.toMatch(
      /cursor snapshot mismatch|INVALID_CURSOR_PAYLOAD|sintetiniai duomenys|Kari Nilsen|Marius/u,
    );
  });

  it("canonicalizes an invalid selected value before any canonical or Payload read", async () => {
    await expect(
      AdminNextPreviewWorkQueuePage({
        searchParams: Promise.resolve({
          limit: "25",
          queue: "all",
          selected: "case:demo",
          view: "today",
        }),
      }),
    ).rejects.toThrow(
      "redirect:/admin-next-preview/work?view=today&queue=all&limit=25",
    );

    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.adapterLoad).not.toHaveBeenCalled();
  });

  it("fails closed on canonical load or exact-target projection errors without a fixture fallback", async () => {
    mocks.adapterLoad.mockRejectedValueOnce(
      new Error("MISSING_EXACT_TARGET: do not expose source detail"),
    );

    const element = await AdminNextPreviewWorkQueuePage({
      searchParams: Promise.resolve({
        limit: "25",
        queue: "all",
        view: "today",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-work-queue-load-state="canonical_error"');
    expect(html).toContain("Darbų eilės nepavyko įkelti iš canonical duomenų.");
    expect(html).toContain('href="/admin-v2"');
    expect(html).not.toMatch(/MISSING_EXACT_TARGET|Kari Nilsen|Marius/u);
  });

  it("rejects a fixture-shaped result returned through the canonical selection", async () => {
    mocks.adapterLoad.mockResolvedValueOnce({
      source: "fixture",
      status: "ready",
      value: [],
      workQueue: createAdminNextWorkQueueFixture("lt", query()),
    });

    const element = await AdminNextPreviewWorkQueuePage({
      searchParams: Promise.resolve({
        limit: "25",
        queue: "all",
        view: "today",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-work-queue-load-state="canonical_error"');
    expect(html).not.toMatch(/sintetiniai duomenys|Kari Nilsen|Marius/u);
  });

  it("uses the rollout legacy fallback before constructing the canonical adapter", async () => {
    vi.stubEnv("FEATURE_ADMIN_EXCEPTION_FLOWS_V2", "false");

    await expect(
      AdminNextPreviewWorkQueuePage({
        searchParams: Promise.resolve({
          limit: "25",
          queue: "all",
          view: "today",
        }),
      }),
    ).rejects.toThrow("redirect:/admin-v2");

    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.createCanonical).not.toHaveBeenCalled();
  });
});
