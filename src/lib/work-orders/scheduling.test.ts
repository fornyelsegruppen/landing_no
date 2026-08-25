import { describe, expect, it } from "vitest";
import {
  arrivalWindowFromTimes,
  defaultArrivalEndTime,
  normalizeArrivalStartTime,
  parseArrivalWindow,
  validateArrivalWindowForSchedule,
} from "./scheduling";

describe("work-order schedule", () => {
  it("rounds legacy minute values to a selectable half-hour and derives a valid end", () => {
    expect(normalizeArrivalStartTime("15:38")).toBe("15:30");
    expect(defaultArrivalEndTime("15:30")).toBe("17:30");
    expect(normalizeArrivalStartTime("23:10")).toBe("22:30");
    expect(defaultArrivalEndTime("22:30")).toBe("23:00");
  });

  it("normalizes a selected arrival interval", () => {
    expect(arrivalWindowFromTimes("08:00", "10:00")).toBe("08:00–10:00");
    expect(parseArrivalWindow("08:00-10:00")).toEqual({ start: "08:00", end: "10:00" });
  });

  it("requires the end and scheduled start to be consistent", () => {
    expect(() => arrivalWindowFromTimes("10:00", "08:00")).toThrow(/later/);
    expect(() => validateArrivalWindowForSchedule("2026-08-26T09:00", "08:00–10:00")).toThrow(/match/);
    expect(validateArrivalWindowForSchedule("2026-08-26T08:00", "08:00–10:00")).toBe("08:00–10:00");
  });
});
