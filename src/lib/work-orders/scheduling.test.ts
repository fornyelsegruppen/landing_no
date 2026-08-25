import { describe, expect, it } from "vitest";
import { arrivalWindowFromTimes, parseArrivalWindow, validateArrivalWindowForSchedule } from "./scheduling";

describe("work-order schedule", () => {
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
