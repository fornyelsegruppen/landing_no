import { describe, expect, it } from "vitest";
import {
  protectRoofFusionOfferCommandAppend,
  rejectRoofFusionOfferCommandDelete,
} from "./RoofFusionOfferCommands";

describe("Roof Fusion offer command persistence", () => {
  it("accepts only trusted canonical appends", () => {
    expect(() =>
      protectRoofFusionOfferCommandAppend({
        context: {},
        data: {},
        operation: "create",
      } as never),
    ).toThrow("canonical Preview bridge");
    expect(
      protectRoofFusionOfferCommandAppend({
        context: { trustedRoofFusionOfferCommandAppend: true },
        data: { ledgerKey: "lead:12:key" },
        operation: "create",
      } as never),
    ).toEqual({ ledgerKey: "lead:12:key" });
  });

  it("rejects updates and deletes", () => {
    expect(() =>
      protectRoofFusionOfferCommandAppend({
        context: { trustedRoofFusionOfferCommandAppend: true },
        data: {},
        operation: "update",
      } as never),
    ).toThrow("append-only");
    expect(() => rejectRoofFusionOfferCommandDelete({} as never)).toThrow(
      "append-only",
    );
  });
});
