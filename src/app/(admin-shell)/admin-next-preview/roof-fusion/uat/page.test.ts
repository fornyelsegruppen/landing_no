import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  requireAdminUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/auth/internal-session", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

import AdminNextRoofFusionUatPage from "./page";

describe("Admin Next Roof Fusion UAT page", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_NEXT_MODE", "preview");
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.notFound.mockClear();
    mocks.requireAdminUser.mockReset().mockResolvedValue({
      interfaceLanguage: "lt",
      role: "admin",
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("renders the authenticated Preview control when RF is enabled", async () => {
    const element = await AdminNextRoofFusionUatPage();

    expect(element.props).toMatchObject({
      defaultCaseReference: "TF-13",
      locale: "lt",
    });
    expect(element.props.action).toBeTypeOf("function");
    expect(element.props.addressLookupAction).toBeTypeOf("function");
  });

  it("does not exist in Production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(AdminNextRoofFusionUatPage()).rejects.toThrow("not-found");
    expect(mocks.requireAdminUser).not.toHaveBeenCalled();
  });

  it("does not exist when the independent RF flag is disabled", async () => {
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "false");

    await expect(AdminNextRoofFusionUatPage()).rejects.toThrow("not-found");
  });
});
