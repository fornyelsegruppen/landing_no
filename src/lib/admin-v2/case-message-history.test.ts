import { describe, expect, it } from "vitest";
import {
  initialCaseMessageHistoryLimit,
  splitCaseMessageHistory,
} from "./case-message-history";

describe("splitCaseMessageHistory", () => {
  it("keeps the five newest loaded messages visible and groups older messages separately", () => {
    const messages = Array.from({ length: 7 }, (_, index) => index + 1);

    expect(initialCaseMessageHistoryLimit).toBe(5);
    expect(splitCaseMessageHistory(messages)).toEqual({
      recent: [1, 2, 3, 4, 5],
      older: [6, 7],
    });
  });
});
