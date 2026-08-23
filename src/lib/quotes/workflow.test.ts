import { describe, expect, it } from "vitest";
import { assertContractTransition, assertQuoteTransition } from "./workflow";

describe("quote and contract workflow", () => {
  it("allows the controlled happy path", () => {
    expect(() => assertQuoteTransition("draft", "approved")).not.toThrow();
    expect(() => assertQuoteTransition("approved", "sent")).not.toThrow();
    expect(() => assertQuoteTransition("viewed", "accepted")).not.toThrow();
    expect(() => assertContractTransition("issued", "signed")).not.toThrow();
  });
  it("does not allow skipping approval or changing a signed contract", () => {
    expect(() => assertQuoteTransition("draft", "sent")).toThrow();
    expect(() => assertContractTransition("signed", "draft")).toThrow();
  });
});
