import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

const mocks = vi.hoisted(() => ({
  adminRfReader: { readLatestSnapshot: vi.fn() },
  adapterLoad: vi.fn(),
  authorization: { kind: "rf-authorization" },
  createCanonical: vi.fn(),
  getPayload: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  payload: { find: vi.fn() },
  repository: { kind: "rf-repository" },
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
vi.mock("@/lib/roof-fusion/preview-read-adapters-v1", () => ({
  AdminRoofFusionPreviewReadAdapterV1: vi.fn(function () {
    return mocks.adminRfReader;
  }),
  PayloadRoofFusionCaseAuthorizationV1: vi.fn(function () {
    return mocks.authorization;
  }),
}));
vi.mock("@/lib/admin-next/case-read-adapter", () => ({
  createAdminNextCanonicalCaseWorkspaceAdapter: mocks.createCanonical,
}));

import AdminNextCaseWorkspacePage from "./page";
import { PayloadRoofSnapshotRepositoryV1 } from "@/lib/roof-fusion/payload-repository-v1";
import {
  AdminRoofFusionPreviewReadAdapterV1,
  PayloadRoofFusionCaseAuthorizationV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";

const admin = {
  active: true,
  id: 7,
  interfaceLanguage: "lt",
  role: "admin",
} as const;

const canonicalView = {
  ...adminNextCaseWorkspaceFixture,
  reference: "TF-13",
  customer: "Canonical customer",
  nextAction: {
    ...adminNextCaseWorkspaceFixture.nextAction,
    href: "/admin-v2/cases/13",
  },
  evidence: [],
  measurementReview: undefined,
  documentPreflight: undefined,
  timeline: [],
  timelineState: {
    status: "unavailable",
    source: "canonical",
    reason: "audit_unavailable",
  },
} as const;

describe("Admin Next canonical Case route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_NEXT_MODE", "preview");
    vi.stubEnv("FEATURE_CASE_STATE_ENGINE_V2", "true");
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.requireAdminUser.mockReset().mockResolvedValue(admin);
    mocks.getPayload.mockReset().mockResolvedValue(mocks.payload);
    mocks.adapterLoad.mockReset().mockResolvedValue({
      status: "ready",
      source: "canonical",
      value: canonicalView,
    });
    mocks.createCanonical
      .mockReset()
      .mockReturnValue({ load: mocks.adapterLoad });
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("passes the server-side role to the canonical audit adapter and keeps unavailable neutral", async () => {
    const element = await AdminNextCaseWorkspacePage({
      params: Promise.resolve({ caseId: "TF-13" }),
    });
    const html = renderToStaticMarkup(element);

    expect(PayloadRoofSnapshotRepositoryV1).toHaveBeenCalledWith(mocks.payload);
    expect(PayloadRoofFusionCaseAuthorizationV1).toHaveBeenCalledWith(
      mocks.payload,
    );
    expect(AdminRoofFusionPreviewReadAdapterV1).toHaveBeenCalledWith(
      mocks.repository,
      mocks.authorization,
    );
    expect(mocks.createCanonical).toHaveBeenCalledWith(mocks.payload, "lt", {
      viewerRole: "admin",
      rfReview: { reader: mocks.adminRfReader, user: admin },
    });
    expect(mocks.adapterLoad).toHaveBeenCalledWith("TF-13");
    expect(element.props).toMatchObject({
      locale: "lt",
      source: "canonical",
      value: { reference: "TF-13", timelineState: canonicalView.timelineState },
    });
    expect(html).toContain('data-audit-history-state="unavailable"');
    expect(html).toContain("Audito istorija laikinai nepasiekiama.");
    expect(html).not.toMatch(/Demo ·|TF-1042/u);
  });

  it("does not call a canonical adapter when the server read role gate denies access", async () => {
    mocks.requireAdminUser.mockResolvedValue({ ...admin, role: "worker" });

    await expect(
      AdminNextCaseWorkspacePage({
        params: Promise.resolve({ caseId: "TF-13" }),
      }),
    ).rejects.toThrow("redirect:/admin-v2/cases");

    expect(mocks.createCanonical).toHaveBeenCalledWith(mocks.payload, "lt", {
      viewerRole: "worker",
      rfReview: undefined,
    });
    expect(mocks.adapterLoad).not.toHaveBeenCalled();
    expect(AdminRoofFusionPreviewReadAdapterV1).not.toHaveBeenCalled();
  });

  it("keeps canonical Case available without an RF dependency when RF rollout is gated", async () => {
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "false");

    const element = await AdminNextCaseWorkspacePage({
      params: Promise.resolve({ caseId: "TF-13" }),
    });

    expect(mocks.createCanonical).toHaveBeenCalledWith(mocks.payload, "lt", {
      viewerRole: "admin",
      rfReview: undefined,
    });
    expect(AdminRoofFusionPreviewReadAdapterV1).not.toHaveBeenCalled();
    expect(element.props.value.reference).toBe("TF-13");
    expect(JSON.stringify(element.props.value)).not.toMatch(/Demo ·|TF-1042/u);
  });

  it.each([
    [
      "nb" as const,
      "Saken kunne ikke lastes fra canonical data. Ingen syntetiske data ble vist.",
      "Åpne eksisterende saker",
    ],
    [
      "lt" as const,
      "Bylos nepavyko įkelti iš canonical duomenų. Sintetiniai duomenys nebuvo parodyti.",
      "Atverti esamas bylas",
    ],
    [
      "en" as const,
      "The case could not be loaded from canonical data. No synthetic data was shown.",
      "Open existing cases",
    ],
  ])(
    "renders a localized, PII-safe canonical load recovery in %s",
    async (locale, message, recovery) => {
      mocks.requireAdminUser.mockResolvedValue({
        ...admin,
        interfaceLanguage: locale,
      });
      mocks.adapterLoad.mockRejectedValue(
        new Error("Kari Nordmann, kari@example.invalid, Demo · TF-1042"),
      );

      const element = await AdminNextCaseWorkspacePage({
        params: Promise.resolve({ caseId: "TF-13" }),
      });
      const html = renderToStaticMarkup(element);

      expect(html).toContain(
        'data-case-workspace-load-state="canonical_error"',
      );
      expect(html).toContain(message);
      expect(html).toContain(recovery);
      expect(html).toContain('href="/admin-v2/cases"');
      expect(html).not.toMatch(
        /Kari Nordmann|kari@example\.invalid|Demo ·|TF-1042/u,
      );
    },
  );

  it("does not fall back to fixture data when canonical initialization fails", async () => {
    mocks.getPayload.mockRejectedValue(
      new Error("canonical database connection failed"),
    );

    const element = await AdminNextCaseWorkspacePage({
      params: Promise.resolve({ caseId: "TF-13" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-case-workspace-load-state="canonical_error"');
    expect(mocks.createCanonical).not.toHaveBeenCalled();
    expect(mocks.adapterLoad).not.toHaveBeenCalled();
    expect(html).not.toMatch(/Demo ·|TF-1042/u);
  });

  it("rejects a fixture-labelled result from the canonical Preview adapter", async () => {
    mocks.adapterLoad.mockResolvedValue({
      status: "ready",
      source: "fixture",
      value: adminNextCaseWorkspaceFixture,
    });

    const element = await AdminNextCaseWorkspacePage({
      params: Promise.resolve({ caseId: "TF-13" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-case-workspace-load-state="canonical_error"');
    expect(html).not.toMatch(/Demo ·|TF-1042/u);
  });
});
