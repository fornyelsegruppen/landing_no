import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  InvalidStateTransitionError,
  type TransitionMap,
} from "./state-machine";

type State = "draft" | "approved" | "sent";

const transitions: TransitionMap<State> = {
  draft: ["approved"],
  approved: ["draft", "sent"],
  sent: [],
};

describe("state transition validation", () => {
  it("permits an explicit transition", () => {
    expect(canTransition(transitions, "approved", "sent")).toBe(true);
    expect(() =>
      assertTransition(transitions, "approved", "sent"),
    ).not.toThrow();
  });

  it("rejects skipped and terminal transitions", () => {
    expect(() => assertTransition(transitions, "draft", "sent")).toThrowError(
      InvalidStateTransitionError,
    );
    expect(() => assertTransition(transitions, "sent", "draft")).toThrow(
      "sent -> draft",
    );
  });
});
