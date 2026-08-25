import { describe, expect, it } from "vitest";
import { protectCaseStateWrites } from "@/payload/collections/Leads";
import { currentTrustedCaseCommandContext, runTrustedCaseCommand } from "./case-command-context";

describe("trusted case command context", () => {
  it("is request-local and permits only the central revisioned write", async () => {
    expect(currentTrustedCaseCommandContext()).toBeUndefined();

    await runTrustedCaseCommand(
      { trustedCaseCommand: true, expectedCaseRevision: 4 },
      async () => {
        expect(currentTrustedCaseCommandContext()).toEqual({
          trustedCaseCommand: true,
          expectedCaseRevision: 4,
        });
        expect(protectCaseStateWrites({
          context: {},
          data: { status: "measuring", caseRevision: 5 },
          operation: "update",
          originalDoc: { caseRevision: 4 },
        } as never)).toMatchObject({ status: "measuring", caseRevision: 5 });
      },
    );

    expect(currentTrustedCaseCommandContext()).toBeUndefined();
  });

  it("still rejects an untrusted direct revision write", () => {
    expect(() => protectCaseStateWrites({
      context: {},
      data: { caseRevision: 2 },
      operation: "update",
      originalDoc: { caseRevision: 1 },
    } as never)).toThrow("Case revision is managed by the central case command layer");
  });
});
