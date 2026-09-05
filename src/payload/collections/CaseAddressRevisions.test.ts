import { describe, expect, it } from "vitest";
import {
  CaseAddressRevisions,
  protectCaseAddressRevisionAppend,
  rejectCaseAddressRevisionDelete,
} from "./CaseAddressRevisions";

describe("Case address revision Payload collection", () => {
  it("is hidden and denies every external operation", () => {
    expect(CaseAddressRevisions.admin).toMatchObject({ hidden: true });
    expect(CaseAddressRevisions.access?.create?.({} as never)).toBe(false);
    expect(CaseAddressRevisions.access?.read?.({} as never)).toBe(false);
    expect(CaseAddressRevisions.access?.update?.({} as never)).toBe(false);
    expect(CaseAddressRevisions.access?.delete?.({} as never)).toBe(false);
  });

  it("accepts only a trusted canonical append", () => {
    expect(() =>
      protectCaseAddressRevisionAppend({
        context: {},
        data: {},
        operation: "create",
      } as never),
    ).toThrow(/canonical Preview command/u);
    expect(
      protectCaseAddressRevisionAppend({
        context: { trustedCaseAddressRevisionAppend: true },
        data: { revisionKey: "lead:7:2" },
        operation: "create",
      } as never),
    ).toEqual({ revisionKey: "lead:7:2" });
  });

  it("rejects update and delete paths", () => {
    expect(() =>
      protectCaseAddressRevisionAppend({
        context: { trustedCaseAddressRevisionAppend: true },
        data: {},
        operation: "update",
      } as never),
    ).toThrow(/append-only/u);
    expect(() => rejectCaseAddressRevisionDelete({} as never)).toThrow(
      /append-only/u,
    );
  });
});
