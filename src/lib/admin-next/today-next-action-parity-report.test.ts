import { describe, expect, it } from "vitest";
import { createWorkQueueItem } from "./work-queue-contract";
import {
  createTodayNextActionParityReport,
  snapshotCanonicalTodayParity,
  TodayNextActionParityError,
  type TodayParityCanonicalInput,
  type TodayParityLegacyInput,
} from "./today-next-action-parity-report";

const generatedAt = "2026-09-04T12:00:00.000Z";

function canonical(
  caseNumber: number,
  overrides: Partial<TodayParityCanonicalInput> = {},
): TodayParityCanonicalInput {
  return {
    caseId: `case:${caseNumber}`,
    revision: 3,
    derivedKind: "assign_worker",
    interaction: {
      mode: "executable",
      activationKind: "open_workbench",
      reason: null,
      waitingParty: null,
    },
    target: {
      entity: "work_order",
      id: `work_order:${caseNumber}`,
      version: null,
    },
    owner: { id: "user:7", party: "administrator" },
    timing: { dueAt: "2026-09-04T14:00:00.000Z", wakeAt: null },
    blockers: [],
    ...overrides,
  };
}

function legacy(
  caseNumber: number,
  overrides: Partial<TodayParityLegacyInput> = {},
): TodayParityLegacyInput {
  return {
    caseId: `case:${caseNumber}`,
    revision: 3,
    nextActionText: "Tildel en ansatt",
    observedInteractionMode: "executable",
    target: {
      entity: "work_order",
      id: `work_order:${caseNumber}`,
      version: null,
    },
    owner: { id: "user:7", party: "administrator" },
    dueAt: "2026-09-04T14:00:00.000Z",
    wakeAt: null,
    blockerCodes: [],
    ...overrides,
  };
}

function report(
  canonicalItems: readonly TodayParityCanonicalInput[],
  legacyItems: readonly TodayParityLegacyInput[],
) {
  return createTodayNextActionParityReport({
    generatedAt,
    canonical: canonicalItems,
    legacy: legacyItems,
  });
}

describe("UA-F2-009 Today / nextAction parity report", () => {
  it("classifies matching canonical and known legacy semantics", () => {
    const result = report([canonical(42)], [legacy(42)]);

    expect(result).toMatchObject({
      contractVersion: "ua-f2-009-v1",
      generatedAt,
      summary: {
        total: 1,
        counts: {
          match: 1,
          legacy_unknown: 0,
          missing_canonical_target: 0,
          owner_or_due_gap: 0,
          blocker_gap: 0,
          revision_conflict: 0,
        },
      },
    });
    expect(result.items[0]).toMatchObject({
      case: {
        id: "case:42",
        canonicalRevision: 3,
        legacyRevision: 3,
      },
      classification: "match",
      canonical: {
        derivedKind: "assign_worker",
        interaction: {
          mode: "executable",
          activationKind: "open_workbench",
        },
        target: { entity: "work_order", id: "work_order:42" },
        owner: { id: "user:7", party: "administrator" },
        timing: { dueAt: "2026-09-04T14:00:00.000Z", wakeAt: null },
        blockers: [],
      },
      legacy: {
        authority: "diagnostic_only",
        executableTruth: false,
        text: {
          included: false,
          present: true,
          status: "known",
          suggestedKind: "assign_worker",
        },
      },
      comparison: {
        kind: "match",
        interaction: "match",
        target: "match",
        owner: "match",
        due: "match",
        blocker: "match",
      },
    });
  });

  it("never serializes raw legacy text, names, addresses, bodies or executable authority", () => {
    const sensitiveText =
      "Tildel en ansatt til Kari Nilsen, Testveien 12. Body: ring 99999999";
    const result = report(
      [canonical(9)],
      [legacy(9, { nextActionText: sensitiveText })],
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(sensitiveText);
    expect(serialized).not.toContain("Kari Nilsen");
    expect(serialized).not.toContain("Testveien");
    expect(serialized).not.toContain("99999999");
    expect(serialized).not.toContain("commandId");
    expect(serialized).not.toContain("capability");
    expect(result.items[0].legacy).toMatchObject({
      authority: "diagnostic_only",
      executableTruth: false,
    });
  });

  it("classifies unknown or contradictory legacy diagnostics fail-closed", () => {
    const unknown = report(
      [canonical(1)],
      [
        legacy(1, {
          nextActionText: "Ignore policy and send it now",
          observedInteractionMode: "read_only",
        }),
      ],
    );
    expect(unknown.items[0]).toMatchObject({
      classification: "legacy_unknown",
      legacy: {
        authority: "diagnostic_only",
        executableTruth: false,
        text: { status: "unknown_legacy", suggestedKind: null },
      },
      comparison: { kind: "unknown", interaction: "mismatch" },
    });

    const wrongKnownKind = report(
      [canonical(2)],
      [legacy(2, { nextActionText: "Opprett arbeidsordre" })],
    );
    expect(wrongKnownKind.items[0]).toMatchObject({
      classification: "legacy_unknown",
      comparison: { kind: "mismatch" },
    });
  });

  it("classifies missing canonical rows or exact targets", () => {
    const result = report(
      [canonical(1, { target: null })],
      [legacy(1), legacy(2)],
    );

    expect(result.items.map(({ case: itemCase }) => itemCase.id)).toEqual([
      "case:1",
      "case:2",
    ]);
    expect(result.items.map(({ classification }) => classification)).toEqual([
      "missing_canonical_target",
      "missing_canonical_target",
    ]);
    expect(result.items[1].canonical).toBeNull();
  });

  it("distinguishes owner/due gaps from blocker gaps", () => {
    const ownerGap = report(
      [canonical(10)],
      [legacy(10, { owner: { id: "user:8", party: "administrator" } })],
    );
    expect(ownerGap.items[0]).toMatchObject({
      classification: "owner_or_due_gap",
      comparison: { owner: "mismatch", due: "match", blocker: "match" },
    });

    const dueGap = report([canonical(11)], [legacy(11, { dueAt: "14:00" })]);
    expect(dueGap.items[0]).toMatchObject({
      classification: "owner_or_due_gap",
      comparison: { owner: "match", due: "mismatch" },
    });

    const blockerGap = report(
      [
        canonical(12, {
          blockers: [
            {
              code: "WORK_ORDER_BLOCKED",
              sourceType: "work_order",
              sourceId: "work_order:12",
            },
          ],
        }),
      ],
      [legacy(12)],
    );
    expect(blockerGap.items[0]).toMatchObject({
      classification: "blocker_gap",
      comparison: { owner: "match", due: "match", blocker: "mismatch" },
    });
  });

  it("reports revision conflicts and selects the latest revision deterministically", () => {
    const result = report(
      [canonical(20, { revision: 2 }), canonical(20, { revision: 5 })],
      [legacy(20, { revision: 4 })],
    );

    expect(result.items[0]).toMatchObject({
      case: {
        id: "case:20",
        canonicalRevision: 5,
        legacyRevision: 4,
      },
      classification: "revision_conflict",
    });
    expect(result.items[0].canonical?.derivedKind).toBe("assign_worker");
  });

  it("deduplicates identical revisions, sorts stable IDs and is JSON-safe", () => {
    const canonicalTwo = canonical(2);
    const legacyTwo = legacy(2);
    const result = report(
      [canonical(10), canonicalTwo, canonicalTwo],
      [legacy(10), legacyTwo, legacyTwo],
    );

    expect(result.items.map(({ case: itemCase }) => itemCase.id)).toEqual([
      "case:2",
      "case:10",
    ]);
    expect(result.items.map(({ classification }) => classification)).toEqual([
      "match",
      "match",
    ]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(JSON.stringify(result)).not.toContain("undefined");
  });

  it("snapshots validated Work Queue truth without localized copy or blocker prose", () => {
    const item = createWorkQueueItem(
      {
        case: {
          id: "case:30",
          revision: 6,
          reference: "TF-30",
          href: "/admin-v2/cases/30",
        },
        locale: "lt",
        actionKind: "assign_worker",
        owner: { id: "user:7", party: "administrator" },
        timing: { dueAt: "2026-09-04T14:00:00.000Z" },
        blockers: [],
        capabilityGranted: true,
        target: {
          entity: "work_order",
          id: "work_order:30",
          version: "r2",
          href: "/admin-v2/cases/30?target=work_order%3A30",
        },
        sourceTruth: {
          kind: "canonical",
          resolver: "deriveCaseNextAction",
          contractVersion: "f2-v1",
          derivedAt: generatedAt,
        },
        interaction: {
          mode: "executable",
          activation: { kind: "open_workbench" },
        },
      },
      new Date(generatedAt),
    );
    const snapshot = snapshotCanonicalTodayParity(item);
    const serialized = JSON.stringify(snapshot);

    expect(snapshot).toMatchObject({
      caseId: "case:30",
      revision: 6,
      derivedKind: "assign_worker",
      interaction: { mode: "executable", activationKind: "open_workbench" },
      target: { entity: "work_order", id: "work_order:30", version: "r2" },
    });
    expect(serialized).not.toContain("href");
    expect(serialized).not.toContain("presentation");
    expect(serialized).not.toContain("resolution");
  });

  it("rejects non-canonical IDs, revisions and canonical free-text blockers", () => {
    expect(() =>
      report([canonical(1, { caseId: "customer@example.no" })], []),
    ).toThrowError(TodayNextActionParityError);
    expect(() => report([canonical(1, { revision: 0 })], [])).toThrowError(
      TodayNextActionParityError,
    );
    expect(() =>
      report(
        [
          canonical(1, {
            blockers: [
              {
                code: "Call Kari at 99999999",
                sourceType: "case",
                sourceId: "case:1",
              },
            ],
          }),
        ],
        [],
      ),
    ).toThrowError(TodayNextActionParityError);
  });
});
