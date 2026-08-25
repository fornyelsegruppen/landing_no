import { describe, expect, it } from "vitest";
import {
  documentedPipelineUpdate,
  measurementPipelineUpdate,
  workOrderPipelineUpdate,
} from "./pipeline-state";

describe("lead pipeline state", () => {
  it("does not regress converted or closed leads to measuring", () => {
    expect(
      measurementPipelineUpdate("converted", "Review measurement"),
    ).toBeNull();
    expect(
      measurementPipelineUpdate("closed", "Review measurement"),
    ).toBeNull();
    expect(
      measurementPipelineUpdate("qualified", "Review measurement"),
    ).toEqual({
      status: "measuring",
      nextAction: "Review measurement",
    });
  });

  it("keeps a completed customer as a converted lead", () => {
    expect(documentedPipelineUpdate()).toEqual({
      status: "converted",
      nextAction: "Oppdrag fullført og dokumentert.",
      nextActionAt: null,
    });
  });

  it.each([
    ["unassigned", "Tildel en ansatt", "2026-08-25T09:00:00.000Z"],
    ["assigned", "Planlegg dato", "2026-08-25T09:00:00.000Z"],
    ["scheduled", "tildelt og planlagt", null],
    ["in_progress", "ansattportalen", null],
    ["blocked", "Kontroller blokkeringen", "2026-08-25T09:00:00.000Z"],
    ["completed", "Sluttkontroller", "2026-08-25T09:00:00.000Z"],
  ] as const)("derives an actionable lead state for %s work", (status, expectedText, nextActionAt) => {
    const result = workOrderPipelineUpdate({
      now: "2026-08-25T09:00:00.000Z",
      scheduledAt: "2026-08-28T08:00:00.000Z",
      status,
    });

    expect(result).toEqual(expect.objectContaining({ status: "converted", nextActionAt }));
    expect(result?.nextAction).toContain(expectedText);
  });

  it("reuses the documented terminal state", () => {
    expect(workOrderPipelineUpdate({ now: "2026-08-25T09:00:00.000Z", status: "documented" }))
      .toEqual(documentedPipelineUpdate());
  });
});
