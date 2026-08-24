import { describe, expect, it } from "vitest";
import {
  documentedPipelineUpdate,
  measurementPipelineUpdate,
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
});
