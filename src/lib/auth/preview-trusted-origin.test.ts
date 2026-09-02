import { describe, expect, it } from "vitest";
import {
  adminNextUatOrigin,
  resolveAdminNextPreviewTrustedOrigin,
} from "./preview-trusted-origin";

describe("Admin Next Preview trusted origin", () => {
  it("allows the stable UAT alias only in Vercel Preview", () => {
    expect(
      resolveAdminNextPreviewTrustedOrigin({ VERCEL_ENV: "preview" }),
    ).toBe(adminNextUatOrigin);
    expect(
      resolveAdminNextPreviewTrustedOrigin({ VERCEL_ENV: "production" }),
    ).toBe("");
    expect(resolveAdminNextPreviewTrustedOrigin({})).toBe("");
  });
});
