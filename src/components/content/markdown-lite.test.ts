import { describe, expect, it } from "vitest";
import { safeContentHref } from "@/lib/safe-content-link";

describe("safe Markdown links", () => {
  it("localizes internal routes", () => {
    expect(safeContentHref("/takvask", "no")).toBe("/no/takvask");
    expect(safeContentHref("/en/takvask", "no")).toBe("/en/takvask");
  });

  it("allows web links and rejects executable schemes", () => {
    expect(safeContentHref("https://www.kartverket.no", "no")).toBe(
      "https://www.kartverket.no",
    );
    expect(safeContentHref("javascript:alert(1)", "no")).toBeNull();
    expect(safeContentHref("data:text/html,test", "no")).toBeNull();
  });
});
