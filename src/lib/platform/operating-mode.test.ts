import { describe, expect, it } from "vitest";
import {
  automaticCommunicationIsPaused,
  buildOperatingMode,
} from "./operating-mode";

describe("platform operating mode", () => {
  it("defaults Production automation to paused", () => {
    expect(automaticCommunicationIsPaused({ VERCEL_ENV: "production" })).toBe(
      true,
    );
    expect(
      automaticCommunicationIsPaused({
        VERCEL_ENV: "production",
        AUTOMATION_EMERGENCY_PAUSE: "false",
      }),
    ).toBe(false);
  });

  it("stays in controlled pilot until real pilot evidence exists", () => {
    const status = buildOperatingMode({
      VERCEL_ENV: "production",
      PLATFORM_OPERATING_MODE: "full_automation",
      PLATFORM_ACTIVE_WAVE: "PROD-8.2",
      FEATURE_AI_DRAFTS: "true",
    });

    expect(status).toMatchObject({
      mode: "controlled_pilot",
      activeWave: "PROD-8.2",
      automaticCommunicationPaused: true,
    });
    expect(status.enabledFeatures).toEqual(["aiDrafts"]);
    expect(status.disabledFeatures).toHaveLength(13);
  });

  it("allows full mode only after lead and physical roof pilot evidence is recorded", () => {
    expect(
      buildOperatingMode({
        PLATFORM_OPERATING_MODE: "full_automation",
        LEAD_INBOX_PILOT_REFERENCE: "pilot-report-30",
        ROOF_VALIDATION_REFERENCE: "physical-roof-comparison-3",
      }).mode,
    ).toBe("full_automation");
  });

  it("keeps full mode closed when only technical roof QA exists", () => {
    expect(
      buildOperatingMode({
        PLATFORM_OPERATING_MODE: "full_automation",
        LEAD_INBOX_PILOT_REFERENCE: "pilot-report-30",
        ROOF_TECHNICAL_QA_REFERENCE: "staging-roof-qa",
      }).mode,
    ).toBe("controlled_pilot");
  });
});
