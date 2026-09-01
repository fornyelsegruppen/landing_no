import { describe, expect, it } from "vitest";
import {
  protectRoofFusionAppendOnlyWrite,
  rejectRoofFusionDelete,
  RoofFusionCommands,
  RoofFusionSnapshots,
} from "./RoofFusion";

describe("Roof Fusion append-only Payload collections", () => {
  it("deny every external collection operation", () => {
    for (const collection of [RoofFusionSnapshots, RoofFusionCommands]) {
      for (const access of Object.values(collection.access ?? {})) {
        expect((access as () => boolean)()).toBe(false);
      }
      expect(collection.admin?.hidden).toBe(true);
    }
  });

  it("accepts only trusted creates and rejects mutation or deletion", () => {
    expect(() =>
      protectRoofFusionAppendOnlyWrite({
        operation: "create",
        context: {},
        data: {},
      } as never),
    ).toThrow(/canonical repository/);
    expect(() =>
      protectRoofFusionAppendOnlyWrite({
        operation: "update",
        context: { trustedRoofFusionAppend: true },
        data: {},
      } as never),
    ).toThrow(/append-only/);
    expect(
      protectRoofFusionAppendOnlyWrite({
        operation: "create",
        context: { trustedRoofFusionAppend: true },
        data: { snapshotId: "roof-1" },
      } as never),
    ).toEqual({ snapshotId: "roof-1" });
    expect(() => rejectRoofFusionDelete({} as never)).toThrow(/append-only/);
  });
});
