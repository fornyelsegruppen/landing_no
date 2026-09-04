import { describe, expect, it } from "vitest";
import { adminNextDarkThemeCss } from "@/lib/admin-next/design-tokens";

describe("Admin Next dark design lock", () => {
  it("defines the centralized graphite, navy and amber contract", () => {
    expect(adminNextDarkThemeCss).toContain("--an-canvas: #080c11");
    expect(adminNextDarkThemeCss).toContain("--an-surface: #101821");
    expect(adminNextDarkThemeCss).toContain("--an-amber: #f4b63f");
    expect(adminNextDarkThemeCss).toContain("--an-text: #f5f7fa");
    expect(adminNextDarkThemeCss).toContain(":focus-visible");
    expect(adminNextDarkThemeCss).toContain("--an-action: var(--an-amber)");
    expect(adminNextDarkThemeCss).toContain("--an-danger:");
    expect(adminNextDarkThemeCss).toContain("forced-colors: active");
    expect(adminNextDarkThemeCss).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps subtle small text at WCAG AA contrast on every supported surface", () => {
    const token = (name: string) => {
      const value = adminNextDarkThemeCss.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
      expect(value, `missing ${name}`).toBeTruthy();
      return value as string;
    };
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (foreground: string, background: string) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };

    for (const surface of ["an-canvas", "an-sidebar", "an-surface", "an-elevated", "an-soft"]) {
      expect(contrast(token("an-subtle"), token(surface)), surface).toBeGreaterThanOrEqual(4.5);
    }
  });
});
