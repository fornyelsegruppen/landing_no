import { describe, expect, it } from "vitest";
import {
  osloLocalDateTime,
  osloScheduleIso,
  osloScheduleValidationReason,
} from "./blog-schedule-time";

describe("Oslo blog schedule time", () => {
  it("formats a saved UTC value as Oslo local time without using the browser zone", () => {
    expect(osloLocalDateTime("2026-01-15T09:30:00.000Z")).toBe(
      "2026-01-15T10:30",
    );
    expect(osloLocalDateTime("2026-07-15T09:30:00.000Z")).toBe(
      "2026-07-15T11:30",
    );
  });

  it("converts an unambiguous Oslo local value to UTC", () => {
    expect(osloScheduleIso("2026-01-15T10:30")).toEqual({
      ok: true,
      iso: "2026-01-15T09:30:00.000Z",
    });
  });

  it("refuses nonexistent spring and ambiguous autumn wall times", () => {
    expect(osloScheduleIso("2026-03-29T02:30")).toEqual({
      ok: false,
      reason: "nonexistent",
    });
    expect(osloScheduleIso("2026-10-25T02:30")).toEqual({
      ok: false,
      reason: "ambiguous",
    });
    expect(osloScheduleValidationReason("2026-03-29T02:30")).toBe(
      "nonexistent",
    );
    expect(osloScheduleValidationReason("2026-10-25T02:30")).toBe("ambiguous");
  });
});
