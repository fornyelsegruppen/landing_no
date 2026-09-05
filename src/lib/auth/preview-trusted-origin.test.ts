import { describe, expect, it } from "vitest";
import {
  adminNextUatOrigin,
  resolveAdminNextPreviewTrustedOrigins,
  roofFusionPreviewOrigin,
} from "./preview-trusted-origin";

describe("Admin Next Preview trusted origin", () => {
  it("allows the stable Admin Next and Roof Fusion aliases only in Vercel Preview", () => {
    expect(
      resolveAdminNextPreviewTrustedOrigins({ VERCEL_ENV: "preview" }),
    ).toEqual([adminNextUatOrigin, roofFusionPreviewOrigin]);
    expect(
      resolveAdminNextPreviewTrustedOrigins({ VERCEL_ENV: "production" }),
    ).toEqual([]);
    expect(resolveAdminNextPreviewTrustedOrigins({})).toEqual([]);
  });
});
