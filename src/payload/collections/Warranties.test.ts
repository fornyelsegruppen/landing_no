import { describe, expect, it } from "vitest";
import { protectWarranty } from "./Warranties";

describe("warranty invariants", () => {
  it("allows expiry or revocation but not reactivation or scope changes", () => {
    expect(protectWarranty({ operation: "update", data: { status: "expired" }, originalDoc: { status: "active" } } as never)).toMatchObject({ status: "expired" });
    expect(() => protectWarranty({ operation: "update", data: { status: "active" }, originalDoc: { status: "expired" } } as never)).toThrow(/Invalid warranty/);
    expect(() => protectWarranty({ operation: "update", data: { scope: "Changed" }, originalDoc: { status: "active", scope: "Original" } } as never)).toThrow(/immutable/);
  });
});
