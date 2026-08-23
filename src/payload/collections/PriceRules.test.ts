import { describe, expect, it } from "vitest";
import { protectApprovedPriceRule } from "./PriceRules";

const admin = { id: 4, active: true, role: "admin" };

describe("price rule approval", () => {
  it("records who approved a rule and when", () => {
    const result = protectApprovedPriceRule({ operation: "update", data: { status: "approved" }, originalDoc: { status: "draft" }, req: { user: admin } } as never) as Record<string, unknown>;
    expect(result.approvedBy).toBe(4);
    expect(result.approvedAt).toEqual(expect.any(String));
  });

  it("rejects an in-place price change after approval", () => {
    expect(() => protectApprovedPriceRule({ operation: "update", data: { unitPriceExVatOre: 20000 }, originalDoc: { status: "approved", unitPriceExVatOre: 10000 }, req: { user: admin } } as never)).toThrow(/new version/);
  });
});
