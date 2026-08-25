import { measurementSnapshotHash } from "./geometry";

export function nextMeasurementVersion(
  current: Record<string, unknown> & { id: string | number; version: number; lead: unknown; reference: string },
  changes: Record<string, unknown>,
  now = new Date(),
) {
  const version = current.version + 1;
  const next = {
    ...current,
    ...changes,
    id: undefined,
    version,
    supersedes: current.id,
    reference: `TM-${typeof current.lead === "object" && current.lead && "id" in current.lead ? (current.lead as { id: unknown }).id : current.lead}-V${version}`,
    status: "review_required",
    approvedBy: null,
    approvedAt: null,
    evidenceSnapshot: null,
    evidenceHash: null,
    evidenceGeneratedAt: null,
    selectionConfirmedBy: null,
    selectionConfirmedAt: null,
    capturedAt: now.toISOString(),
  };
  return Object.assign({}, next, { inputHash: measurementSnapshotHash(next) });
}
