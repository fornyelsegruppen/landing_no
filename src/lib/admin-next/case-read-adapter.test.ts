import { describe, expect, it, vi } from "vitest";
import type { AdminCaseWorkspace } from "@/lib/admin-v2/case-read-model";
import {
  loadAdminNextCaseAuditHistory,
  loadAdminNextCaseRfEntry,
  loadAdminNextCaseRfReviewHref,
  projectAdminCaseWorkspace,
  projectAdminNextCaseStages,
} from "@/lib/admin-next/case-read-adapter";
import {
  parseAdminNextRfRoute,
  resolveAdminNextRfWorkbench,
} from "@/lib/admin-next/rf-route-contract";
import { buildRoofFusionPreviewUatGoldenPlanV1 } from "@/lib/roof-fusion/preview-uat-golden-v1";

function workspace(): AdminCaseWorkspace {
  return {
    lead: {
      id: 13,
      name: "Canonical customer",
      recordState: "active",
      revision: 1,
    },
    nextAction: { kind: "none" },
    documents: [],
    timeline: [
      {
        id: "quote-21",
        sourceCollection: "quotes",
        sourceId: 21,
        type: "quote",
        title: "Q-21",
        at: "2026-09-04T09:00:00.000Z",
        href: "/admin/collections/quotes/21",
      },
    ],
  } as unknown as AdminCaseWorkspace;
}

function event(overrides: Record<string, unknown>) {
  return {
    id: 1,
    action: "case.updated",
    entityType: "lead",
    entityId: "13",
    correlationId: "corr-case-13",
    createdAt: "2026-09-04T10:00:00.000Z",
    updatedAt: "2026-09-04T10:00:00.000Z",
    ...overrides,
  };
}

function measurementWorkspace(): AdminCaseWorkspace {
  return {
    ...workspace(),
    lead: {
      ...workspace().lead,
      revision: 7,
    },
    measurement: {
      id: 31,
      reference: "R4-31",
      status: "review_required",
      href: "/admin/collections/roof-measurements/31",
    },
    nextAction: { kind: "approve_measurement", targetId: 31 },
  } as unknown as AdminCaseWorkspace;
}

const truncatedPageMetadata = [
  ["hasNextPage", { hasNextPage: true, totalDocs: 1, totalPages: 1 }],
  ["totalDocs", { hasNextPage: false, totalDocs: 201, totalPages: 1 }],
  ["totalPages", { hasNextPage: false, totalDocs: 1, totalPages: 2 }],
] as const;

describe("Admin Next canonical case audit read", () => {
  it("reads exact case entities and projects correlated events without PII", async () => {
    const seed = [
      event({ correlationId: "corr-lead-13" }),
      event({
        id: 2,
        entityType: "quote",
        entityId: "21",
        correlationId: "corr-quote-21",
      }),
    ];
    const correlated = [
      event({
        id: 3,
        actor: {
          id: 7,
          displayName: "Aistė",
          email: "aiste@example.invalid",
        },
        correlationId: "corr-lead-13",
        changedFields: ["status", "caseRevision"],
        metadata: {
          result: "succeeded",
          reason: "stale_revision",
          version: "v2",
          source: "admin-api",
        },
        body: "private customer message",
      }),
      event({
        id: 4,
        action: "quote.updated",
        entityType: "quote",
        entityId: "21",
        correlationId: "corr-quote-21",
        createdAt: "2026-09-04T11:00:00.000Z",
        metadata: {
          result: "succeeded",
          email: "customer@example.invalid",
        },
      }),
      event({
        id: 5,
        entityId: "99",
        correlationId: "corr-other-case",
        createdAt: "2026-09-04T12:00:00.000Z",
      }),
    ];
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: seed })
      .mockResolvedValueOnce({ docs: correlated });

    const result = await loadAdminNextCaseAuditHistory(
      { find } as never,
      workspace(),
      "admin",
    );

    expect(find).toHaveBeenCalledTimes(2);
    expect(find.mock.calls[0]?.[0]).toMatchObject({
      collection: "audit-events",
      depth: 0,
      limit: 200,
      overrideAccess: true,
      select: {
        entityType: true,
        entityId: true,
        correlationId: true,
      },
      sort: "-createdAt",
    });
    expect(find.mock.calls[0]?.[0].where).toEqual({
      or: expect.arrayContaining([
        {
          and: [
            { entityType: { equals: "lead" } },
            { entityId: { equals: "13" } },
          ],
        },
        {
          and: [
            { entityType: { equals: "case" } },
            { entityId: { equals: "lead-13" } },
          ],
        },
        {
          and: [
            { entityType: { equals: "quote" } },
            { entityId: { equals: "21" } },
          ],
        },
      ]),
    });
    expect(find.mock.calls[1]?.[0].where).toEqual({
      correlationId: { in: ["corr-lead-13", "corr-quote-21"] },
    });
    expect(find.mock.calls[1]?.[0]).toMatchObject({
      depth: 1,
      populate: { users: { displayName: true } },
      select: {
        actor: true,
        action: true,
        entityType: true,
        entityId: true,
        correlationId: true,
        changedFields: true,
        beforeHash: true,
        afterHash: true,
        metadata: true,
        createdAt: true,
      },
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected ready audit");
    expect(result.value.order).toBe("newest_first");
    expect(result.value.items.map(({ id }) => id)).toEqual([4, 3]);
    expect(result.value.items[0]).toMatchObject({
      metadataStatus: "rejected",
      result: null,
      source: null,
    });
    expect(result.value.items[1]).toMatchObject({
      actor: { kind: "user", id: "7", display: "Aistė" },
      changedFields: ["caseRevision", "status"],
      result: "succeeded",
      reason: "stale_revision",
      version: "v2",
      source: "admin-api",
    });

    const projected = projectAdminCaseWorkspace(
      workspace(),
      new Date("2026-09-04T09:00:00.000Z"),
      "lt",
      result,
    );
    expect(projected.timelineState).toEqual({
      status: "ready",
      source: "canonical",
    });
    expect(projected.timeline.map(({ audit }) => audit?.action)).toEqual([
      "quote.updated",
      "case.updated",
    ]);
    const serialized = JSON.stringify(projected.timeline);
    expect(serialized).not.toMatch(
      /aiste@example|customer@example|private customer message|"body"|"email"|"metadata"|"from"|"to"/u,
    );
    expect(serialized).not.toMatch(/Demo ·|TF-1042/u);
  });

  it.each(truncatedPageMetadata)(
    "fails closed when seed audit pagination reports truncation via %s",
    async (_signal, pagination) => {
      const find = vi.fn().mockResolvedValue({
        docs: [event({ correlationId: "corr-lead-13" })],
        ...pagination,
      });

      const result = await loadAdminNextCaseAuditHistory(
        { find } as never,
        workspace(),
        "admin",
      );

      expect(result).toEqual({
        status: "unavailable",
        source: "canonical",
        reason: "canonical_audit_unavailable",
      });
      expect(find).toHaveBeenCalledTimes(1);
    },
  );

  it.each(truncatedPageMetadata)(
    "fails closed without a partial timeline when correlated pagination reports truncation via %s",
    async (_signal, pagination) => {
      const find = vi
        .fn()
        .mockResolvedValueOnce({
          docs: [event({ correlationId: "corr-lead-13" })],
          hasNextPage: false,
          totalDocs: 1,
          totalPages: 1,
        })
        .mockResolvedValueOnce({
          docs: [event({ action: "must.not.render" })],
          ...pagination,
        });

      const result = await loadAdminNextCaseAuditHistory(
        { find } as never,
        workspace(),
        "admin",
      );
      const projected = projectAdminCaseWorkspace(
        workspace(),
        new Date("2026-09-04T09:00:00.000Z"),
        "lt",
        result,
      );

      expect(result).toEqual({
        status: "unavailable",
        source: "canonical",
        reason: "canonical_audit_unavailable",
      });
      expect(find).toHaveBeenCalledTimes(2);
      expect(projected.timeline).toEqual([]);
      expect(projected.timelineState).toEqual({
        status: "unavailable",
        source: "canonical",
        reason: "audit_unavailable",
      });
      expect(JSON.stringify(projected)).not.toContain("must.not.render");
    },
  );

  it("denies audit reads before Payload for a role without audit.read", async () => {
    const find = vi.fn();

    await expect(
      loadAdminNextCaseAuditHistory({ find } as never, workspace(), "worker"),
    ).resolves.toEqual({
      status: "denied",
      source: "canonical",
      reason: "audit_read_denied",
    });
    expect(find).not.toHaveBeenCalled();
  });

  it("returns neutral canonical unavailable state without a fixture fallback", async () => {
    const find = vi.fn().mockRejectedValue(new Error("db secret"));
    const result = await loadAdminNextCaseAuditHistory(
      { find } as never,
      workspace(),
      "admin",
    );

    expect(result).toEqual({
      status: "unavailable",
      source: "canonical",
      reason: "canonical_audit_unavailable",
    });
    const projected = projectAdminCaseWorkspace(
      workspace(),
      new Date("2026-09-04T09:00:00.000Z"),
      "en",
      result,
    );
    expect(projected.timeline).toEqual([]);
    expect(projected.timelineState).toEqual({
      status: "unavailable",
      source: "canonical",
      reason: "audit_unavailable",
    });
    expect(JSON.stringify(projected)).not.toMatch(/db secret|Demo ·|TF-1042/u);
  });
});

describe("Admin Next canonical Case to RF discoverability", () => {
  it("classifies new only after an authorized latest-snapshot read confirms absence", async () => {
    const value = {
      ...workspace(),
      measurement: undefined,
      nextAction: { kind: "prepare_package" as const },
    } as AdminCaseWorkspace;
    const readLatestSnapshot = vi.fn().mockResolvedValue(null);
    const user = { id: 7, role: "admin" } as never;

    await expect(
      loadAdminNextCaseRfEntry(value, {
        reader: { readLatestSnapshot },
        user,
      }),
    ).resolves.toEqual({
      state: "new",
      mode: "new",
      href: null,
      reason: "creation_not_authorized",
    });
    expect(readLatestSnapshot).toHaveBeenCalledWith("lead:13", user);
  });

  it("does not call existing RF work new when the canonical measurement target is missing", async () => {
    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(13))
      .finalSnapshot;
    const value = {
      ...workspace(),
      measurement: undefined,
      nextAction: { kind: "prepare_package" as const },
    } as AdminCaseWorkspace;

    await expect(
      loadAdminNextCaseRfEntry(value, {
        reader: { readLatestSnapshot: vi.fn().mockResolvedValue(snapshot) },
        user: { id: 7, role: "admin" } as never,
      }),
    ).resolves.toEqual({
      state: "blocked",
      mode: null,
      href: null,
      reason: "target_unavailable",
    });
  });

  it("does not substitute the first related object when the canonical action target is missing", () => {
    const value = measurementWorkspace();
    const projected = projectAdminCaseWorkspace(
      {
        ...value,
        nextAction: { kind: "approve_measurement" },
      },
      new Date("2026-09-04T09:00:00.000Z"),
      "lt",
    );

    expect(projected.nextAction).toMatchObject({
      kind: "approve_measurement",
      href: null,
      interaction: { mode: "read_only", reason: "target_unavailable" },
    });
    expect(projected.evidence[0]?.fallbackHref).toBeNull();
  });

  it("does not fall back to another operator route when the canonical RF entry is blocked", () => {
    const value = measurementWorkspace();
    const projected = projectAdminCaseWorkspace(
      {
        ...value,
        measurement: {
          ...value.measurement!,
          href: "/admin-v2/measurements/31",
        },
      },
      new Date("2026-09-04T09:00:00.000Z"),
      "lt",
      undefined,
      {
        grantedCapabilities: ["measurement.review_approve"],
        rfEntry: {
          state: "blocked",
          mode: null,
          href: null,
          reason: "snapshot_blocked",
        },
      },
    );

    expect(projected.nextAction).toMatchObject({
      href: null,
      label: null,
      interaction: { mode: "read_only", reason: "target_unavailable" },
    });
    expect(projected.evidence[0]?.previewHref).toBeUndefined();
  });

  it("builds the displayed CTA only from an exact current authorized snapshot binding", async () => {
    const value = measurementWorkspace();
    const snapshot = (
      await buildRoofFusionPreviewUatGoldenPlanV1(value.lead.id)
    ).finalSnapshot;
    const user = {
      active: true,
      email: "admin@example.invalid",
      id: 7,
      role: "admin",
    } as never;
    const readLatestSnapshot = vi.fn().mockResolvedValue(snapshot);

    const href = await loadAdminNextCaseRfReviewHref(value, {
      reader: { readLatestSnapshot },
      user,
    });

    expect(readLatestSnapshot).toHaveBeenCalledWith("lead:13", user);
    expect(href).not.toBeNull();
    const parsed = parseAdminNextRfRoute(href!);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("expected valid RF route");
    if (parsed.value.mode !== "review") {
      throw new Error("expected RF review route");
    }
    expect(parsed.value).toMatchObject({
      mode: "review",
      case: { id: 13, reference: "TF-13", revision: 7 },
      measurement: {
        id: snapshot.snapshotId,
        revision: snapshot.revision,
      },
      snapshot: {
        id: snapshot.snapshotId,
        revision: snapshot.revision,
        hash: snapshot.snapshotHash,
      },
      returnTo:
        "/admin-next-preview/cases/TF-13?tab=evidence#case-evidence-title",
    });

    const deniedProjection = projectAdminCaseWorkspace(
      value,
      new Date("2026-09-04T09:00:00.000Z"),
      "lt",
      undefined,
      { rfReviewHref: href },
    );
    expect(deniedProjection.nextAction).toMatchObject({
      href: null,
      label: null,
      interaction: { mode: "read_only", reason: "capability_denied" },
    });

    const projected = projectAdminCaseWorkspace(
      value,
      new Date("2026-09-04T09:00:00.000Z"),
      "lt",
      undefined,
      {
        rfReviewHref: href,
        grantedCapabilities: ["measurement.review_approve"],
      },
    );
    expect(projected.nextAction.href).toBe(href);
    expect(projected.nextAction.interaction).toEqual({
      mode: "executable",
      activation: "open_workbench",
    });
    expect(projected.evidence[0]).toMatchObject({
      fallbackHref: null,
      previewAction: "review_measurement",
      previewHref: href,
    });
    expect(JSON.stringify(projected)).not.toMatch(
      /Demo ·|TF-1042|admin@example\.invalid/u,
    );

    const stale = resolveAdminNextRfWorkbench(parsed.value, {
      case: { ...parsed.value.case, revision: 8 },
      measurement: parsed.value.measurement,
      snapshot: parsed.value.snapshot,
    });
    expect(stale).toEqual({
      ok: false,
      reason: "case_revision_stale",
      returnTo: parsed.value.returnTo,
    });
  });

  it.each([
    ["missing", vi.fn().mockResolvedValue(null)],
    ["unauthorized", vi.fn().mockRejectedValue(new Error("CAPABILITY_DENIED"))],
  ])(
    "keeps the non-RF recovery when the current snapshot is %s",
    async (_condition, readLatestSnapshot) => {
      const value = measurementWorkspace();
      const href = await loadAdminNextCaseRfReviewHref(value, {
        reader: { readLatestSnapshot },
        user: { email: "admin@example.invalid", id: 7, role: "admin" } as never,
      });
      const projected = projectAdminCaseWorkspace(
        value,
        new Date("2026-09-04T09:00:00.000Z"),
        "lt",
        undefined,
        { rfReviewHref: href },
      );

      expect(href).toBeNull();
      expect(projected.nextAction.href).toBeNull();
      expect(projected.evidence[0]).toMatchObject({
        fallbackHref: null,
      });
      expect(projected.evidence[0]?.previewHref).toBeUndefined();
      expect(JSON.stringify(projected)).not.toMatch(
        /admin-next-preview\/cases\/TF-13\/measurements|Demo ·|TF-1042|admin@example\.invalid/u,
      );
    },
  );

  it("fails closed when the latest snapshot is bound to a different legacy measurement", async () => {
    const value = measurementWorkspace();
    const snapshot = (
      await buildRoofFusionPreviewUatGoldenPlanV1(value.lead.id)
    ).finalSnapshot;

    await expect(
      loadAdminNextCaseRfReviewHref(value, {
        reader: {
          readLatestSnapshot: vi.fn().mockResolvedValue({
            ...snapshot,
            subject: { ...snapshot.subject, legacyMeasurementId: 99 },
          }),
        },
        user: { id: 7, role: "admin" } as never,
      }),
    ).resolves.toBeNull();
  });

  it("projects an unmapped stored blocker without free text or a technical admin target", () => {
    const value = measurementWorkspace();
    const projected = projectAdminCaseWorkspace(
      {
        ...value,
        lead: {
          ...value.lead,
          nextActionBlocker: "customer@example.invalid needs review",
        },
      },
      new Date("2026-09-04T09:00:00.000Z"),
      "lt",
    );

    expect(projected.status).toBe("attention");
    expect(projected.nextAction).toMatchObject({
      href: null,
      label: null,
      diagnosticBlocker: { code: "UNMAPPED_LEGACY_BLOCKER" },
    });
    expect(projected.evidence[0]?.fallbackHref).toBeNull();
    expect(JSON.stringify(projected)).not.toMatch(
      /customer@example\.invalid|\/admin\/collections/u,
    );
  });

  it("recognizes every canonical waiting mode and keeps a missing SLA neutral", () => {
    const projected = projectAdminCaseWorkspace(
      {
        ...workspace(),
        nextAction: { kind: "wait_worker_precheck", targetId: 44 },
        workOrder: {
          id: 44,
          href: "/admin/collections/work-orders/44",
          reference: "WO-44",
          status: "ready",
        },
      } as AdminCaseWorkspace,
      new Date("2026-09-04T09:00:00.000Z"),
      "lt",
    );

    expect(projected.status).toBe("waiting");
    expect(projected.sla).toEqual({
      deadline: "—",
      remainingMinutes: null,
      state: "unknown",
    });
    expect(projected.nextAction.interaction).toEqual({
      mode: "waiting",
      waitingParty: "worker",
    });
    expect(projected.nextAction.href).toBeNull();
  });
});

describe("Admin Next canonical Case state projection", () => {
  it("projects the canonical blocked stage without adding a second current stage", () => {
    const value = {
      ...workspace(),
      nextAction: { kind: "resolve_work_block", targetId: 44 },
      workOrder: {
        id: 44,
        href: "/admin/collections/work-orders/44",
        reference: "WO-44",
        status: "blocked",
      },
    } as AdminCaseWorkspace;

    expect(projectAdminNextCaseStages(value)).toEqual([
      { id: "inquiry", state: "complete" },
      { id: "evidence", state: "complete" },
      { id: "commercial", state: "complete" },
      { id: "agreement", state: "complete" },
      { id: "work", state: "blocked" },
      { id: "completion", state: "upcoming" },
    ]);
  });

  it("projects all six stages complete for a terminal canonical case", () => {
    const value = workspace();
    expect(
      projectAdminNextCaseStages({
        ...value,
        lead: { ...value.lead, status: "closed" },
      }),
    ).toEqual(
      [
        "inquiry",
        "evidence",
        "commercial",
        "agreement",
        "work",
        "completion",
      ].map((id) => ({ id, state: "complete" })),
    );
  });
});
