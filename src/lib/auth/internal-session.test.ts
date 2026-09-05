import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminNextPreviewWorkQueueEntry } from "@/lib/admin-next/work-queue-navigation";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({ auth: mocks.auth })),
}));

import { adminLoginHref, getInternalUser } from "./internal-session";

describe("admin login return path", () => {
  beforeEach(() => {
    delete process.env.PAYLOAD_BUILD_WITHOUT_DB;
    mocks.auth.mockReset();
  });

  it("uses the persisted profile locale as the protected panel source of truth", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        active: true,
        email: "owner@example.no",
        id: 7,
        interfaceLanguage: "lt",
        role: "admin",
      },
    });

    await expect(getInternalUser()).resolves.toMatchObject({
      id: 7,
      interfaceLanguage: "lt",
    });
  });

  it("returns to the verified ONE UI entry only in Preview", () => {
    expect(
      adminLoginHref({
        environment: { VERCEL_ENV: "preview" },
        returnTo: adminNextPreviewWorkQueueEntry,
      }),
    ).toBe(
      `/admin/login?redirect=${encodeURIComponent(adminNextPreviewWorkQueueEntry)}`,
    );
  });

  it.each(["production", "development"])(
    "keeps the global Admin V2 default in %s",
    (VERCEL_ENV) => {
      expect(
        adminLoginHref({
          environment: { VERCEL_ENV },
          returnTo: adminNextPreviewWorkQueueEntry,
        }),
      ).toBe("/admin/login?redirect=%2Fadmin-v2");
    },
  );

  it("does not accept an arbitrary internal or external return path", () => {
    expect(
      adminLoginHref({
        environment: { VERCEL_ENV: "preview" },
        returnTo: "https://evil.example/steal",
      }),
    ).toBe("/admin/login?redirect=%2Fadmin-v2");
    expect(
      adminLoginHref({
        environment: { VERCEL_ENV: "preview" },
        returnTo: "/admin-next-preview/system",
      }),
    ).toBe("/admin/login?redirect=%2Fadmin-v2");
  });
});
