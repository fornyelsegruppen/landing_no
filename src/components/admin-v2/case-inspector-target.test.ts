// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { findCaseInspectorTarget } from "./case-inspector";

afterEach(() => {
  document.body.replaceChildren();
});

describe("inspector-scoped DOM target lookup", () => {
  it.each(["message-1", "invoice-31", "warranty-126"])(
    "finds the portal's %s despite the earlier page duplicate",
    (id) => {
      const pageRecord = document.createElement("article");
      pageRecord.id = id;
      const inspector = document.createElement("div");
      const inspectorRecord = document.createElement("article");
      inspectorRecord.id = id;
      inspectorRecord.tabIndex = -1;
      inspector.append(inspectorRecord);
      document.body.append(pageRecord, inspector);
      expect(document.getElementById(id)).toBe(pageRecord);
      const target = findCaseInspectorTarget(inspector, id);
      expect(target).toBe(inspectorRecord);
      target?.focus();
      expect(document.activeElement).toBe(inspectorRecord);
    },
  );

  it("never returns an outside-only record and treats special IDs literally", () => {
    const outside = document.createElement("article");
    outside.id = "invoice-31";
    const inspector = document.createElement("div");
    const literal = document.createElement("article");
    literal.id = 'message-1\"] , body';
    inspector.append(literal);
    document.body.append(outside, inspector);
    expect(findCaseInspectorTarget(inspector, "invoice-31")).toBeNull();
    expect(findCaseInspectorTarget(inspector, literal.id)).toBe(literal);
    expect(findCaseInspectorTarget(inspector, "")).toBeNull();
  });
});
