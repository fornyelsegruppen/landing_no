import { describe, expect, it } from "vitest";
import {
  formatNorwayDateTime,
  formatNorwayDateTimeInput,
  norwayDateKey,
  norwayLocalDateTimeToIso,
} from "./norway-time";

describe("Norway time", () => {
  it("uses Oslo summer time for stored instants", () => {
    expect(norwayLocalDateTimeToIso("2026-08-25T00:00")).toBe(
      "2026-08-24T22:00:00.000Z",
    );
    expect(formatNorwayDateTimeInput("2026-08-24T22:00:00.000Z")).toBe(
      "2026-08-25T00:00",
    );
  });

  it("uses Oslo winter time and date boundaries", () => {
    expect(norwayLocalDateTimeToIso("2026-01-15T08:30")).toBe(
      "2026-01-15T07:30:00.000Z",
    );
    expect(norwayDateKey("2026-08-24T22:30:00.000Z")).toBe("2026-08-25");
  });

  it("formats every panel language in the same business timezone", () => {
    const instant = "2026-08-24T22:00:00.000Z";
    expect(formatNorwayDateTime(instant, "nb-NO")).toContain("00:00");
    expect(formatNorwayDateTime(instant, "lt-LT")).toContain("00:00");
    expect(formatNorwayDateTime(instant, "en-GB")).toContain("00:00");
  });

  it("formats legal signature instants in Norwegian summer time", () => {
    expect(
      formatNorwayDateTime("2026-08-26T10:57:22.000Z", "nb-NO", {
        dateStyle: "medium",
        timeStyle: "medium",
      }),
    ).toContain("12:57:22");
  });
});
