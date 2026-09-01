import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    const original = await importOriginal<
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

describe("Admin Next R4 Preview page route", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_NEXT_MODE", "preview");
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.requireAdminUser.mockReset().mockResolvedValue(admin);
    mocks.getPayload.mockReset().mockResolvedValue(mocks.payload);
    mocks.payload.findByID.mockReset().mockResolvedValue({
      id: 13,
      name: "Canonical UAT Customer",
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
    const snapshot = (
      await buildRoofFusionPreviewUatGoldenPlanV1(13)
    ).finalSnapshot;
    mocks.adminReader.readLatestSnapshot.mockResolvedValue(snapshot);

    const element = await AdminNextR4MeasurementPage({
      params: Promise.resolve({
        caseId: "TF-13",
        measurementId: snapshot.snapshotId,
      }),
    });

    expect(PayloadRoofSnapshotRepositoryV1).toHaveBeenCalledWith(mocks.payload);
    expect(PayloadRoofFusionCaseAuthorizationV1).toHaveBeenCalledWith(
      mocks.payload,
    );
    expect(AdminRoofFusionPreviewReadAdapterV1).toHaveBeenCalledWith(
      mocks.repository,
      mocks.authorization,
    );
    expect(mocks.adminReader.readLatestSnapshot).toHaveBeenCalledWith(
      "lead:13",
      admin,
    );
    expect(element.props).toMatchObject({
      caseReference: "TF-13",
      customer: "Canonical UAT Customer",
      locale: "lt",
      measurement: { reference: snapshot.snapshotId },
    });
  });

  it("uses the fixture only after an authorized canonical absence", async () => {
    mocks.adminReader.readLatestSnapshot.mockResolvedValue(null);

    const element = await AdminNextR4MeasurementPage({
      params: Promise.resolve({
        caseId: "TF-1042",
        measurementId: "R4-2026-1042",
      }),
    });

    expect(mocks.adminReader.readLatestSnapshot).toHaveBeenCalledWith(
      "lead:1042",
      admin,
    );
    expect(element.props.measurement).toMatchObject({
      reference: "R4-2026-1042",
    });
    expect(mocks.payload.findByID).not.toHaveBeenCalled();
  });

  it("denies the Preview route in Production before Payload access", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(
      AdminNextR4MeasurementPage({
        params: Promise.resolve({
          caseId: "TF-13",
          measurementId: "rf-uat-lead-13-r3-approved",
        }),
      }),
    ).rejects.toThrow(/redirect:/);
    expect(mocks.getPayload).not.toHaveBeenCalled();
  });
});
