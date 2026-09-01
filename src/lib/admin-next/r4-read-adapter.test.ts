import { describe, expect, it, vi } from "vitest";
import { buildApprovedGableRoofFixtureV1 } from "@/lib/roof-fusion/gable-roof-fixture-v1";
import { createAdminNextCanonicalR4Adapter } from "@/lib/admin-next/r4-read-adapter";

describe("Admin Next canonical R4 reader", () => {
  it("consumes the accepted roof-snapshot.v1 read contract", async () => {
    const snapshot = buildApprovedGableRoofFixtureV1().approvedSnapshot;
    const repository = {
      readLatestSnapshot: vi.fn().mockResolvedValue(snapshot),
      readSnapshot: vi.fn().mockResolvedValue(null),
    };
    const result = await createAdminNextCanonicalR4Adapter(repository).load(
      snapshot.subject.caseId,
      snapshot.snapshotId,
    );
    expect(result).toMatchObject({
      status: "ready",
      source: "canonical",
      value: {
        reference: snapshot.snapshotId,
        state: "verified",
        planeCount: snapshot.geometry.surfaces.length,
        provenance: { checksum: snapshot.snapshotHash },
      },
    });
  });

  it("fails closed when no persistent snapshot reader is available", async () => {
    const repository = {
      readLatestSnapshot: vi.fn().mockResolvedValue(null),
      readSnapshot: vi.fn(),
    };
    await expect(createAdminNextCanonicalR4Adapter(repository).load("TF-1", "R4-1"))
      .resolves.toEqual({ status: "not_found" });
    expect(repository.readSnapshot).not.toHaveBeenCalled();
  });
});
