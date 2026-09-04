import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ADMIN_NEXT_RF_ROUTE_VERSION,
  buildAdminNextRfRoute,
  type AdminNextRfRoute,
} from "@/lib/admin-next/rf-route-contract";
import { buildRoofFusionPreviewUatGoldenPlanV1 } from "@/lib/roof-fusion/preview-uat-golden-v1";

const mocks = vi.hoisted(() => ({
  adminReader: {
    readLatestSnapshot: vi.fn(),
    readSnapshot: vi.fn(),
  },
  authorization: { kind: "payload-case-authorization" },
  getPayload: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  payload: { findByID: vi.fn() },
  repository: { kind: "payload-roof-repository" },
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
vi.mock("@/lib/roof-fusion/payload-repository-v1", () => ({
  PayloadRoofSnapshotRepositoryV1: vi.fn(function () {
    return mocks.repository;
  }),
}));
vi.mock(
  "@/lib/roof-fusion/preview-read-adapters-v1",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("@/lib/roof-fusion/preview-read-adapters-v1")
      >();
    return {
      ...original,
      AdminRoofFusionPreviewReadAdapterV1: vi.fn(function () {
        return mocks.adminReader;
      }),
      PayloadRoofFusionCaseAuthorizationV1: vi.fn(function () {
        return mocks.authorization;
      }),
    };
  },
);

import { PayloadRoofSnapshotRepositoryV1 } from "@/lib/roof-fusion/payload-repository-v1";
import {
  AdminRoofFusionPreviewReadAdapterV1,
  PayloadRoofFusionCaseAuthorizationV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";
import AdminNextR4MeasurementPage from "./page";

const admin = {
  active: true,
  email: "admin@example.invalid",
  id: 7,
  interfaceLanguage: "lt",
  role: "admin",
} as const;

function pageProps(value: AdminNextRfRoute) {
  const url = new URL(buildAdminNextRfRoute(value), "https://admin.invalid");
  const parts = url.pathname.split("/");
  const searchParams: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    searchParams[key] = values.length === 1 ? values[0] : values;
  }
  return {
    params: Promise.resolve({
      caseId: decodeURIComponent(parts[3]),
      measurementId: decodeURIComponent(parts[5]),
    }),
    searchParams: Promise.resolve(searchParams),
  };
}

describe("Admin Next R4 Preview page route", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_NEXT_MODE", "preview");
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.requireAdminUser.mockReset().mockResolvedValue(admin);
    mocks.getPayload.mockReset().mockResolvedValue(mocks.payload);
    mocks.payload.findByID.mockReset().mockResolvedValue({
      address: "Testgata 13",
      assignedTo: {
        displayName: "Aistė",
        email: "aiste@example.invalid",
      },
      city: "Oslo",
      caseRevision: 1,
      id: 13,
      name: "Canonical UAT Customer",
      postal: "0013",
      updatedAt: "2026-09-04T10:00:00.000Z",
    });
    mocks.adminReader.readLatestSnapshot.mockReset();
    mocks.adminReader.readSnapshot.mockReset().mockResolvedValue(null);
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
    vi.mocked(PayloadRoofSnapshotRepositoryV1).mockClear();
    vi.mocked(PayloadRoofFusionCaseAuthorizationV1).mockClear();
    vi.mocked(AdminRoofFusionPreviewReadAdapterV1).mockClear();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("constructs the Payload RF authorization chain and binds the admin read", async () => {
    const plan = await buildRoofFusionPreviewUatGoldenPlanV1(13);
    const snapshot = plan.finalSnapshot;
    const previous = plan.snapshots.find(
      (item) => item.snapshotId === snapshot.supersedesSnapshotId,
    );
    mocks.adminReader.readSnapshot.mockImplementation(
      async (_caseId: string, snapshotId: string) =>
        snapshotId === snapshot.snapshotId ? snapshot : previous || null,
    );

    const element = await AdminNextR4MeasurementPage(
      pageProps({
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "review",
        case: { id: 13, reference: "TF-13", revision: 1 },
        measurement: { id: snapshot.snapshotId, revision: snapshot.revision },
        snapshot: {
          id: snapshot.snapshotId,
          revision: snapshot.revision,
          hash: snapshot.snapshotHash,
        },
        blocker: null,
        evidence: [],
        returnTo: "/admin-v2/cases/13?tab=measurement#measurement-section",
      }),
    );

    expect(PayloadRoofSnapshotRepositoryV1).toHaveBeenCalledWith(mocks.payload);
    expect(PayloadRoofFusionCaseAuthorizationV1).toHaveBeenCalledWith(
      mocks.payload,
    );
    expect(AdminRoofFusionPreviewReadAdapterV1).toHaveBeenCalledWith(
      mocks.repository,
      mocks.authorization,
    );
    expect(mocks.adminReader.readSnapshot).toHaveBeenCalledWith(
      "lead:13",
      snapshot.snapshotId,
      admin,
    );
    expect(mocks.adminReader.readLatestSnapshot).not.toHaveBeenCalled();
    expect(element.props).toMatchObject({
      address: "Testgata 13, 0013, Oslo",
      caseReference: "TF-13",
      customer: "Canonical UAT Customer",
      locale: "lt",
      measurement: { reference: snapshot.snapshotId },
      owner: "Aistė",
      returnTo: "/admin-v2/cases/13?tab=measurement#measurement-section",
    });
    expect(mocks.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "leads", depth: 1, id: 13 }),
    );
    const html = renderToStaticMarkup(element);
    expect(
      html.match(
        /href="\/admin-v2\/cases\/13\?tab=measurement#measurement-section"/gu,
      ),
    ).toHaveLength(2);
  });

  it.each([
    ["lt", "Nepriskirta"],
    ["nb", "Ikke tildelt"],
    ["en", "Unassigned"],
  ] as const)(
    "uses the localized neutral owner for an unassigned canonical lead in %s",
    async (locale, expectedOwner) => {
      mocks.requireAdminUser.mockResolvedValue({
        ...admin,
        interfaceLanguage: locale,
      });
      const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(13))
        .finalSnapshot;
      mocks.adminReader.readLatestSnapshot.mockResolvedValue(snapshot);
      mocks.payload.findByID.mockResolvedValue({
        address: "Canonical gate 13",
        assignedTo: null,
        caseRevision: 1,
        city: "Oslo",
        id: 13,
        name: "Canonical Customer",
        postal: "0013",
        updatedAt: "2026-09-04T10:00:00.000Z",
      });

      const element = await AdminNextR4MeasurementPage(
        pageProps({
          version: ADMIN_NEXT_RF_ROUTE_VERSION,
          mode: "resume",
          case: { id: 13, reference: "TF-13", revision: 1 },
          measurement: {
            id: snapshot.snapshotId,
            revision: snapshot.revision,
          },
          snapshot: null,
          blocker: null,
          evidence: [],
          returnTo: "/admin-v2/cases/13",
        }),
      );
      const html = renderToStaticMarkup(element);

      expect(element.props).toMatchObject({
        customer: "Canonical Customer",
        owner: expectedOwner,
        source: "canonical",
      });
      expect(html).toContain(expectedOwner);
      expect(html).not.toMatch(/Demo ·|Marius Hansen/u);
    },
  );

  it("never substitutes an email for the canonical owner display", async () => {
    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(13))
      .finalSnapshot;
    mocks.adminReader.readLatestSnapshot.mockResolvedValue(snapshot);
    mocks.payload.findByID.mockResolvedValue({
      address: "Canonical gate 13",
      assignedTo: {
        displayName: "private-owner@example.invalid",
        email: "private-owner@example.invalid",
      },
      caseRevision: 1,
      city: "Oslo",
      id: 13,
      name: "Canonical Customer",
      postal: "0013",
      updatedAt: "2026-09-04T10:00:00.000Z",
    });

    const element = await AdminNextR4MeasurementPage(
      pageProps({
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "resume",
        case: { id: 13, reference: "TF-13", revision: 1 },
        measurement: {
          id: snapshot.snapshotId,
          revision: snapshot.revision,
        },
        snapshot: null,
        blocker: null,
        evidence: [],
        returnTo: "/admin-v2/cases/13",
      }),
    );
    const html = renderToStaticMarkup(element);

    expect(element.props.owner).toBe("Nepriskirta");
    expect(html).not.toContain("private-owner@example.invalid");
    expect(html).not.toMatch(/Demo ·|Marius Hansen/u);
  });

  it("renders a valid new route as explicit read-only recovery instead of 404", async () => {
    const element = await AdminNextR4MeasurementPage(
      pageProps({
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "new",
        case: { id: 13, reference: "TF-13", revision: 1 },
        measurement: null,
        snapshot: null,
        blocker: null,
        evidence: [],
        returnTo: "/admin-v2/cases/13?tab=measurement#measurement-section",
      }),
    );
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-rf-load-state="new_measurement_unavailable"');
    expect(html).toContain("tik skaitymo režimo");
    expect(html).toContain(
      'href="/admin-v2/cases/13?tab=measurement#measurement-section"',
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.getPayload).toHaveBeenCalledTimes(1);
    expect(mocks.adminReader.readLatestSnapshot).not.toHaveBeenCalled();
    expect(mocks.adminReader.readSnapshot).not.toHaveBeenCalled();
  });

  it("renders canonical missing recovery without leaking the demo fixture", async () => {
    mocks.adminReader.readLatestSnapshot.mockResolvedValue(null);

    const element = await AdminNextR4MeasurementPage(
      pageProps({
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "resume",
        case: { id: 1042, reference: "TF-1042", revision: 1 },
        measurement: { id: "R4-2026-1042", revision: 1 },
        snapshot: null,
        blocker: "measurement.review_required",
        evidence: ["EVD-R4-1042-01"],
        returnTo: "/admin-v2/cases/1042?tab=measurement#measurement-section",
      }),
    );
    const html = renderToStaticMarkup(element);

    expect(mocks.adminReader.readLatestSnapshot).toHaveBeenCalledWith(
      "lead:1042",
      admin,
    );
    expect(html).toContain('data-rf-load-state="canonical_snapshot_missing"');
    expect(html).toContain("Kanoninis RF snapshot nerastas");
    expect(html).toContain(
      'href="/admin-v2/cases/1042?tab=measurement#measurement-section"',
    );
    expect(html).not.toContain("Demo ·");
    expect(html).not.toContain("TF-1042");
    expect(html).not.toContain("R4-2026-1042");
    expect(mocks.payload.findByID).not.toHaveBeenCalled();
  });

  it("keeps the explicit local fixture selection separate from canonical missing", async () => {
    vi.stubEnv("VERCEL_ENV", "development");

    const element = await AdminNextR4MeasurementPage(
      pageProps({
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "resume",
        case: { id: 1042, reference: "TF-1042", revision: 1 },
        measurement: { id: "R4-2026-1042", revision: 1 },
        snapshot: null,
        blocker: null,
        evidence: [],
        returnTo: "/admin-v2/cases/1042",
      }),
    );

    expect(element.props).toMatchObject({
      customer: "Demo · Kari Nilsen",
      measurement: { reference: "R4-2026-1042" },
      source: "fixture",
    });
    expect(mocks.adminReader.readLatestSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed on an external return target before Payload access", async () => {
    await expect(
      AdminNextR4MeasurementPage({
        params: Promise.resolve({
          caseId: "TF-13",
          measurementId: "rf-uat-lead-13-r3-approved",
        }),
        searchParams: Promise.resolve({
          mode: "resume",
          caseRevision: "1",
          measurementRevision: "1",
          returnTo: "https://evil.example/admin-v2/cases/13",
        }),
      }),
    ).rejects.toThrow("not-found");

    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.adminReader.readLatestSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed when mode and path measurement context disagree", async () => {
    await expect(
      AdminNextR4MeasurementPage({
        params: Promise.resolve({
          caseId: "TF-13",
          measurementId: "rf-uat-lead-13-r3-approved",
        }),
        searchParams: Promise.resolve({
          mode: "new",
          caseRevision: "1",
          returnTo: "/admin-v2/cases/13",
        }),
      }),
    ).rejects.toThrow("not-found");

    expect(mocks.getPayload).not.toHaveBeenCalled();
  });

  it("fails closed when required route context is missing", async () => {
    await expect(
      AdminNextR4MeasurementPage({
        params: Promise.resolve({
          caseId: "TF-13",
          measurementId: "rf-uat-lead-13-r3-approved",
        }),
        searchParams: Promise.resolve({
          mode: "resume",
          measurementRevision: "3",
          returnTo: "/admin-v2/cases/13",
        }),
      }),
    ).rejects.toThrow("not-found");

    expect(mocks.getPayload).not.toHaveBeenCalled();
  });

  it("renders stale case context as recovery with the same return target", async () => {
    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(13))
      .finalSnapshot;
    mocks.adminReader.readLatestSnapshot.mockResolvedValue(snapshot);
    mocks.payload.findByID.mockResolvedValue({
      address: "Testgata 13",
      caseRevision: 2,
      city: "Oslo",
      id: 13,
      name: "Canonical UAT Customer",
      postal: "0013",
      updatedAt: "2026-09-04T10:00:00.000Z",
    });

    const element = await AdminNextR4MeasurementPage(
      pageProps({
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "resume",
        case: { id: 13, reference: "TF-13", revision: 1 },
        measurement: { id: snapshot.snapshotId, revision: snapshot.revision },
        snapshot: null,
        blocker: null,
        evidence: [],
        returnTo:
          "/admin-next-preview/cases/TF-13?tab=evidence#case-evidence-title",
      }),
    );
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-rf-load-state="case_revision_stale"');
    expect(html).toContain(
      'href="/admin-next-preview/cases/TF-13?tab=evidence#case-evidence-title"',
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("renders stale review snapshot hash as recovery, never as another version", async () => {
    const plan = await buildRoofFusionPreviewUatGoldenPlanV1(13);
    const snapshot = plan.finalSnapshot;
    const previous = plan.snapshots.find(
      (item) => item.snapshotId === snapshot.supersedesSnapshotId,
    );
    mocks.adminReader.readSnapshot.mockImplementation(
      async (_caseId: string, snapshotId: string) =>
        snapshotId === snapshot.snapshotId ? snapshot : previous || null,
    );

    const element = await AdminNextR4MeasurementPage(
      pageProps({
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "review",
        case: { id: 13, reference: "TF-13", revision: 1 },
        measurement: { id: snapshot.snapshotId, revision: snapshot.revision },
        snapshot: {
          id: snapshot.snapshotId,
          revision: snapshot.revision,
          hash: "b".repeat(64),
        },
        blocker: null,
        evidence: [],
        returnTo: "/admin-v2/cases/13",
      }),
    );
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-rf-load-state="snapshot_hash_stale"');
    expect(html).not.toContain('aria-labelledby="r4-drawer-title"');
  });

  it("does not convert an authorization failure into a workbench recovery", async () => {
    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(13))
      .finalSnapshot;
    mocks.adminReader.readLatestSnapshot.mockRejectedValue(
      new Error("CAPABILITY_DENIED"),
    );

    await expect(
      AdminNextR4MeasurementPage(
        pageProps({
          version: ADMIN_NEXT_RF_ROUTE_VERSION,
          mode: "resume",
          case: { id: 13, reference: "TF-13", revision: 1 },
          measurement: {
            id: snapshot.snapshotId,
            revision: snapshot.revision,
          },
          snapshot: null,
          blocker: null,
          evidence: [],
          returnTo: "/admin-v2/cases/13",
        }),
      ),
    ).rejects.toThrow("CAPABILITY_DENIED");
    expect(mocks.payload.findByID).not.toHaveBeenCalled();
  });

  it("stops before route and Payload reads when the admin session is unauthorized", async () => {
    mocks.requireAdminUser.mockRejectedValue(new Error("Unauthorized"));

    await expect(
      AdminNextR4MeasurementPage(
        pageProps({
          version: ADMIN_NEXT_RF_ROUTE_VERSION,
          mode: "new",
          case: { id: 13, reference: "TF-13", revision: 1 },
          measurement: null,
          snapshot: null,
          blocker: null,
          evidence: [],
          returnTo: "/admin-v2/cases/13",
        }),
      ),
    ).rejects.toThrow("Unauthorized");
    expect(mocks.getPayload).not.toHaveBeenCalled();
  });

  it("applies the server-read role gate before returning new-mode recovery", async () => {
    mocks.requireAdminUser.mockResolvedValue({ ...admin, role: "worker" });

    await expect(
      AdminNextR4MeasurementPage(
        pageProps({
          version: ADMIN_NEXT_RF_ROUTE_VERSION,
          mode: "new",
          case: { id: 13, reference: "TF-13", revision: 1 },
          measurement: null,
          snapshot: null,
          blocker: null,
          evidence: [],
          returnTo: "/admin-v2/cases/13",
        }),
      ),
    ).rejects.toThrow(/redirect:/u);
    expect(mocks.adminReader.readLatestSnapshot).not.toHaveBeenCalled();
    expect(mocks.adminReader.readSnapshot).not.toHaveBeenCalled();
  });

  it("redirects when the RF rollout dependency is disabled", async () => {
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "false");

    await expect(
      AdminNextR4MeasurementPage(
        pageProps({
          version: ADMIN_NEXT_RF_ROUTE_VERSION,
          mode: "new",
          case: { id: 13, reference: "TF-13", revision: 1 },
          measurement: null,
          snapshot: null,
          blocker: null,
          evidence: [],
          returnTo: "/admin-v2/cases/13",
        }),
      ),
    ).rejects.toThrow(/redirect:/u);
    expect(mocks.getPayload).not.toHaveBeenCalled();
  });

  it("denies the Preview route in Production before Payload access", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(
      AdminNextR4MeasurementPage({
        params: Promise.resolve({
          caseId: "TF-13",
          measurementId: "rf-uat-lead-13-r3-approved",
        }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(/redirect:/);
    expect(mocks.getPayload).not.toHaveBeenCalled();
  });
});
