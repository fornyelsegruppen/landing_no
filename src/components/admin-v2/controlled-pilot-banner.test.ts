import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildOperatingMode } from "@/lib/platform/operating-mode";
import { ControlledPilotBanner } from "./controlled-pilot-banner";

describe("controlled pilot banner", () => {
  it("shows the wave, disabled count and emergency pause to the administrator", () => {
    const html = renderToStaticMarkup(
      createElement(ControlledPilotBanner, {
        locale: "lt",
        status: buildOperatingMode({
          VERCEL_ENV: "production",
          PLATFORM_ACTIVE_WAVE: "PROD-8.0",
        }),
      }),
    );

    expect(html).toContain("Kontroliuojamas pilotas");
    expect(html).toContain("PROD-8.0");
    expect(html).toContain("13 dar išjungta");
    expect(html).toContain("siuntimai pristabdyti");
  });
});
