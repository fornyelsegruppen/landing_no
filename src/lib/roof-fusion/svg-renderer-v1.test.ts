import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import { renderApprovedRoofSnapshotSvgV1 } from "./svg-renderer-v1";

function approvedEnvelope() {
  return buildApprovedGableRoofFixtureV1().rendererEnvelope;
}

describe("approved Roof Snapshot SVG renderer", () => {
  it("produces a byte-stable customer-safe visual proof from the approved payload", () => {
    const envelope = approvedEnvelope();
    const first = renderApprovedRoofSnapshotSvgV1(envelope);
    const second = renderApprovedRoofSnapshotSvgV1(envelope);

    expect(first.bytes.equals(second.bytes)).toBe(true);
    expect(first.artifactHash).toBe(
      "b07061adc816c35e82903bce011b10bb1a704b7605d9f344e6724dadbebca6ca",
    );
    expect(first.sourceSnapshotHash).toBe(envelope.sourceSnapshotHash);
    expect(first.sourceRendererHash).toBe(envelope.payload.renderHash);
    expect(first.svg).toContain('data-surface-id="surface-south"');
    expect(first.svg).toContain('data-edge-type="ridge"');
    expect(first.svg).toContain('data-opening-id="opening-skylight"');
    expect(first.svg).toContain('data-obstacle-id="obstacle-chimney"');
    expect(first.svg).toContain("Synthetic RF fixture (authorized)");
    expect(first.svg).not.toContain("src-manual");
    expect(first.svg).not.toContain("Takfornyelse administrator");

    const golden = readFileSync(
      new URL(
        "./__fixtures__/gable-roof-approved-v1.golden.svg",
        import.meta.url,
      ),
      "utf8",
    ).trimEnd();
    expect(first.svg).toBe(golden);
  });

  it("refuses an unapproved renderer payload", () => {
    const envelope = approvedEnvelope();
    const invalid = structuredClone(envelope);
    invalid.payload.displayState = "review_required";
    expect(() => renderApprovedRoofSnapshotSvgV1(invalid)).toThrow(
      /approved roof renderer payload/,
    );
  });
});
