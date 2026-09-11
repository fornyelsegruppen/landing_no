import { describe, expect, it } from "vitest";
import { safeContentHref } from "./safe-content-link";

describe("Norwegian blog service links", () => {
  it("renders generated service paths under the Norwegian locale", () => {
    expect(safeContentHref("/takvask", "no")).toBe("/no/takvask");
    expect(safeContentHref("/takmaling", "no")).toBe("/no/takmaling");
  });
});
