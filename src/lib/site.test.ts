import { describe, expect, it } from "vitest";
import { isSiteLocale } from "./site";

describe("site locales", () => {
  it("accepts only published locale route segments", () => {
    expect(isSiteLocale("no")).toBe(true);
    expect(isSiteLocale("en")).toBe(true);
    expect(isSiteLocale("meta.json")).toBe(false);
    expect(isSiteLocale("admin-v2")).toBe(false);
  });
});
