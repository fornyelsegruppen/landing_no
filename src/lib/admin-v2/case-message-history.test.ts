import { describe, expect, it } from "vitest";
import {
  initialCaseMessageHistoryLimit,
  splitCaseMessageHistory,
} from "./case-message-history";

describe("splitCaseMessageHistory", () => {
  it("keeps the five newest loaded messages visible and groups older messages separately", () => {
    const messages = Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
    }));

    expect(initialCaseMessageHistoryLimit).toBe(5);
    expect(splitCaseMessageHistory(messages)).toEqual({
      recent: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
      older: [{ id: 6 }, { id: 7 }],
    });
  });

  it("omits the reply already displayed by the primary question workbench", () => {
    const messages = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
    }));

    expect(splitCaseMessageHistory(messages, 2)).toEqual({
      recent: [{ id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }],
      older: [],
    });
  });
});
