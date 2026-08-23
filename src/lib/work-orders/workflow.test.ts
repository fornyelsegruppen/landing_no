import { describe, expect, it } from "vitest";
import { assertWorkOrderTransition } from "./workflow";

describe("work-order workflow", () => {
  it("allows the documented worker sequence", () => {
    const sequence = ["scheduled", "on_way", "arrived", "precheck", "ready", "in_progress", "completed", "documented"] as const;
    for (let index = 1; index < sequence.length; index += 1) {
      expect(() => assertWorkOrderTransition(sequence[index - 1], sequence[index])).not.toThrow();
    }
  });

  it("does not allow a worker to skip mandatory controls", () => {
    expect(() => assertWorkOrderTransition("scheduled", "in_progress")).toThrow(/Invalid/);
    expect(() => assertWorkOrderTransition("arrived", "ready")).toThrow(/Invalid/);
    expect(() => assertWorkOrderTransition("in_progress", "documented")).toThrow(/Invalid/);
  });
});
