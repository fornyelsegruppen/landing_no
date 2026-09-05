import { describe, expect, it } from "vitest";
import { adminNextPreviewWorkQueueEntry } from "@/lib/admin-next/work-queue-navigation";
import { adminLoginHref } from "./internal-session";

describe("admin login return path", () => {
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
