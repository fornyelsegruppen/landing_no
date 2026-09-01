import { describe, expect, it } from "vitest";
import geometryFixture from "./__fixtures__/gable-roof-geometry-input-v1.json";
import {
  canonicalJsonV1,
  canonicalSha256V1,
  canonicalizeJsonValueV1,
  compareCanonicalStringsV1,
} from "./canonicalization-v1";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import {
  calculateRoofGeometryV1,
  roofGeometryInputV1Schema,
} from "./geometry-calculation-v1";
import { buildRoofSourceRequestV1 } from "./source-adapter-v1";

describe("Roof Fusion canonicalization v1", () => {
  it("uses deterministic code-unit ordering without locale collation", () => {
    expect(["ä", "z", "a", "Z", "A"].sort(compareCanonicalStringsV1)).toEqual([
      "A",
      "Z",
      "a",
      "z",
      "ä",
    ]);
    expect(canonicalJsonV1({ z: 1, ä: 2, a: 3, Z: 4, A: 5 })).toBe(
      '{"A":5,"Z":4,"a":3,"z":1,"ä":2}',
    );

    const originalLocaleCompare = String.prototype.localeCompare;
    let result:
      | {
          fixtureSnapshotHash: string;
          fixtureRenderHash: string;
          geometryInputHash: string;
          geometryCalculationHash: string;
        }
      | undefined;
    try {
      String.prototype.localeCompare = () => {
        throw new Error("localeCompare must not participate in RF hashes");
      };
      const fixture = buildApprovedGableRoofFixtureV1();
      const calculation = calculateRoofGeometryV1(
        roofGeometryInputV1Schema.parse(geometryFixture),
      );
      result = {
        fixtureSnapshotHash: fixture.approvedSnapshot.snapshotHash,
        fixtureRenderHash: fixture.svgArtifact.artifactHash,
        geometryInputHash: calculation.inputHash,
        geometryCalculationHash: calculation.calculationHash,
      };
    } finally {
      String.prototype.localeCompare = originalLocaleCompare;
    }

    expect(result?.fixtureSnapshotHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(result?.fixtureRenderHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(result?.geometryInputHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(result?.geometryCalculationHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("normalizes LF, CRLF, lone CR, and canonically equivalent Unicode", () => {
    const lf = {
      rationale: "first line\nsecond line\nCafé",
      nested: ["north\nsouth"],
    };
    const platformVariants = [
      {
        rationale: "first line\r\nsecond line\r\nCafe\u0301",
        nested: ["north\r\nsouth"],
      },
      {
        rationale: "first line\rsecond line\rCafé",
        nested: ["north\rsouth"],
      },
    ];

    for (const variant of platformVariants) {
      expect(canonicalJsonV1(variant)).toBe(canonicalJsonV1(lf));
      expect(canonicalSha256V1(variant, "rf-platform-invariance.v1")).toBe(
        canonicalSha256V1(lf, "rf-platform-invariance.v1"),
      );
    }
  });

  it("omits optional undefined fields with JSON-compatible array semantics", () => {
    const input = {
      present: "value",
      optional: undefined,
      nested: { optional: undefined, present: true },
      array: ["value", undefined],
    };

    expect(canonicalizeJsonValueV1(input)).toEqual({
      present: "value",
      nested: { present: true },
      array: ["value", null],
    });
    expect(canonicalJsonV1(input)).toBe(
      '{"array":["value",null],"nested":{"present":true},"present":"value"}',
    );
  });

  it("returns the same source request and input hash for LF and CRLF", () => {
    const requestFor = (rationale: string) =>
      buildRoofSourceRequestV1({
        schemaVersion: "roof-source-request.v1",
        requestId: "request-platform-invariance-001",
        caseId: "case-platform-invariance",
        targetSnapshotId: "roof-platform-invariance-r1",
        expectedInputVersion: "platform-invariance.v1",
        adapterId: "platform-invariance-adapter",
        idempotencyKey: "roof-source:platform-invariance:001",
        requestedAt: "2026-09-01T08:00:00.000Z",
        input: {
          rationale,
        },
      });

    const lf = requestFor("first line\nsecond line");
    const crlf = requestFor("first line\r\nsecond line");
    expect(crlf).toEqual(lf);
    expect(crlf.inputHash).toBe(lf.inputHash);
  });
});
