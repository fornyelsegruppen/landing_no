import { describe, expect, it } from "vitest";
import { nextMeasurementVersion } from "./versioning";

describe("measurement versioning", () => {
  it("creates a new version when polygon or slope is edited", () => {
    const result = nextMeasurementVersion({ id: 7, version: 1, lead: 2, reference: "TM-2-V1", roofPlanes: [{ angle: 22 }] }, { roofPlanes: [{ angle: 27 }] }, new Date("2026-08-23T12:00:00Z"));
    expect(result).toMatchObject({ id: undefined, version: 2, supersedes: 7, reference: "TM-2-V2", status: "review_required", roofPlanes: [{ angle: 27 }] });
    expect(result.inputHash).toHaveLength(64);
  });
});
