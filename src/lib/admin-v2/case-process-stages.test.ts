import { describe, expect, it } from "vitest";
import {
  CASE_PROCESS_STAGE_IDS,
  resolveCaseProcessStages,
} from "./case-process-stages";

describe("case process stages", () => {
  it("keeps the six business stages stable", () => {
    expect(CASE_PROCESS_STAGE_IDS).toEqual([
      "contact",
      "measurement",
      "commercial",
      "agreement",
      "work",
      "completion",
    ]);
  });

  it("marks earlier stages completed, one stage current and later stages not started", () => {
    expect(
      resolveCaseProcessStages({ activeStageId: "agreement" }).map(
        ({ id, isCurrent, state }) => ({ id, isCurrent, state }),
      ),
    ).toEqual([
      { id: "contact", isCurrent: false, state: "completed" },
      { id: "measurement", isCurrent: false, state: "completed" },
      { id: "commercial", isCurrent: false, state: "completed" },
      { id: "agreement", isCurrent: true, state: "current" },
      { id: "work", isCurrent: false, state: "not_started" },
      { id: "completion", isCurrent: false, state: "not_started" },
    ]);
  });

  it("represents a blocker on the active stage without adding another stage", () => {
    const stages = resolveCaseProcessStages({
      activeStageId: "work",
      activeStageState: "blocked",
    });

    expect(stages).toHaveLength(6);
    expect(stages.filter((stage) => stage.isCurrent)).toEqual([
      expect.objectContaining({ id: "work", state: "blocked" }),
    ]);
    expect(stages.at(-1)).toEqual({
      id: "completion",
      index: 5,
      isCurrent: false,
      state: "not_started",
    });
  });

  it("supports the first and final boundary stages", () => {
    expect(
      resolveCaseProcessStages({ activeStageId: "contact" }).map(
        (stage) => stage.state,
      ),
    ).toEqual([
      "current",
      "not_started",
      "not_started",
      "not_started",
      "not_started",
      "not_started",
    ]);

    expect(
      resolveCaseProcessStages({ activeStageId: "completion" }).map(
        (stage) => stage.state,
      ),
    ).toEqual([
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "current",
    ]);
  });
});
