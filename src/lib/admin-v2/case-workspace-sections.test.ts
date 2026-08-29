import { describe, expect, it } from "vitest";
import {
  caseWorkspaceSectionByKey,
  caseWorkspaceSectionHref,
  caseWorkspaceSectionKeys,
  caseWorkspaceSections,
  caseWorkspaceSpecialTargets,
  isCaseWorkspaceInternalTarget,
  validateCaseWorkspaceInternalTargets,
} from "./case-workspace-sections";

describe("case workspace section registry", () => {
  it("contains every canonical section key exactly once", () => {
    const keys = caseWorkspaceSections.map((section) => section.key);
    const ids = caseWorkspaceSections.map((section) => section.id);

    expect(keys).toEqual(caseWorkspaceSectionKeys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("binds labels and hrefs to the same canonical registry", () => {
    for (const key of caseWorkspaceSectionKeys) {
      const section = caseWorkspaceSectionByKey[key];
      expect(section.labelKey).toBe(`sections.${key}`);
      expect(caseWorkspaceSectionHref(key)).toBe(`#${section.id}`);
      expect(isCaseWorkspaceInternalTarget(`#${section.id}`)).toBe(true);
    }
  });

  it("inventories unique legacy and special V3 targets", () => {
    expect(new Set(caseWorkspaceSpecialTargets).size).toBe(
      caseWorkspaceSpecialTargets.length,
    );
    for (const id of caseWorkspaceSpecialTargets) {
      expect(isCaseWorkspaceInternalTarget(`#${id}`)).toBe(true);
    }
  });

  it("accepts only known static or exact dynamic entity anchors", () => {
    const valid = [
      "#customer-section",
      "#case-primary-action",
      "#message-42",
      "#invoice-7",
      "#warranty-9",
    ];
    expect(validateCaseWorkspaceInternalTargets(valid)).toEqual([]);

    const invalid = [
      "messages-section",
      "#unknown-section",
      "#message-not-a-number",
      "https://example.com/#customer-section",
      "#",
      "#%E0%A4%A",
    ];
    expect(validateCaseWorkspaceInternalTargets(invalid)).toEqual(invalid);
  });
});
