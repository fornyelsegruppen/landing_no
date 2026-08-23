import { describe, expect, it } from "vitest";
import { assertChangeTransition } from "./workflow";

describe("change agreement workflow", () => {
  it("requires approval before sending and customer action", () => {
    expect(() => assertChangeTransition("draft", "approved")).not.toThrow();
    expect(() => assertChangeTransition("approved", "sent")).not.toThrow();
    expect(() => assertChangeTransition("sent", "accepted")).not.toThrow();
    expect(() => assertChangeTransition("draft", "sent")).toThrow();
    expect(() => assertChangeTransition("approved", "accepted")).toThrow();
  });
});
