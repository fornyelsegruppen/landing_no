import { describe, expect, it } from "vitest";
import { adminNextDarkThemeCss } from "@/lib/admin-next/design-tokens";

describe("Admin Next dark design lock", () => {
  it("defines the centralized graphite, navy and amber contract", () => {
    expect(adminNextDarkThemeCss).toContain("--an-canvas: #080c11");
    expect(adminNextDarkThemeCss).toContain("--an-surface: #101821");
    expect(adminNextDarkThemeCss).toContain("--an-amber: #f4b63f");
    expect(adminNextDarkThemeCss).toContain("--an-text: #f5f7fa");
    expect(adminNextDarkThemeCss).toContain(":focus-visible");
  });
});
