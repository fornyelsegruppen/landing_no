import { describe, expect, it } from "vitest";
import type { AdminCaseListItem } from "@/lib/admin-v2/case-list";
import {
  parseCanonicalWorkQueueQuery,
  parseWorkQueueCursor,
} from "./work-queue-contract";
import {
  projectAdminCaseListWorkQueue,
  WorkQueueReadAdapterError,
  type AdminCaseListWorkQueueRow,
  type ProjectAdminCaseListWorkQueueInput,
} from "./work-queue-read-adapter";

const now = new Date("2026-09-04T10:00:00.000Z");

function caseItem(
  id: number,
  overrides: Partial<AdminCaseListItem> = {},
): AdminCaseListItem {
  return {
    customer: `Customer ${id}`,
    href: `/admin-v2/cases/${id}`,
    id,
    nextAction: "generate_reply",
    nextActionBlockers: [],
    overdue: false,
    recordState: "active",
    revision: 1,
    ...overrides,
  };
}

function row(
  id: number,
  overrides: Partial<AdminCaseListWorkQueueRow> = {},
): AdminCaseListWorkQueueRow {
  return {
    item: caseItem(id),
    caseRevision: 1,
    ownerId: "admin:7",
    blockers: [],
    capabilityGranted: true,
    ...overrides,
  };
}

function query(value = "view=today&queue=all&limit=25") {
  const parsed = parseCanonicalWorkQueueQuery(value);
  if (!parsed.ok) throw new Error(`Invalid test query: ${parsed.code}`);
  return parsed.value;
}

function projectionInput(
  rows: readonly AdminCaseListWorkQueueRow[],
  overrides: Partial<ProjectAdminCaseListWorkQueueInput> = {},
): ProjectAdminCaseListWorkQueueInput {
  return {
    rows,
    locale: "lt",
    now,
    query: query(),
    sourceKind: "canonical",
    ...overrides,
  };
}

function expectAdapterError(
  callback: () => unknown,
  code: WorkQueueReadAdapterError["code"],
) {
  try {
    callback();
    throw new Error("Expected WorkQueueReadAdapterError");
  } catch (error) {
    expect(error).toBeInstanceOf(WorkQueueReadAdapterError);
    expect((error as WorkQueueReadAdapterError).code).toBe(code);
  }
}

describe("AdminCaseList Work Queue read adapter", () => {
  it("deduplicates by stable case ID and newest revision, then sorts by canonical priority", () => {
    const result = projectAdminCaseListWorkQueue(
      projectionInput([
        row(2, {
          item: caseItem(2, { dueAt: "2026-09-05T10:00:00.000Z" }),
        }),
        row(20, {
          caseRevision: 1,
          item: caseItem(20, { dueAt: "2026-09-06T10:00:00.000Z" }),
        }),
        row(20, {
          caseRevision: 2,
          item: caseItem(20, { dueAt: "2026-09-03T10:00:00.000Z" }),
        }),
      ]),
    );

    expect(result.items.map((item) => item.case.id)).toEqual([
      "case:20",
      "case:2",
    ]);
    expect(result.items[0]).toMatchObject({
      case: { id: "case:20", revision: 2, href: "/admin-v2/cases/20" },
      locale: "lt",
      action: {
        kind: "generate_reply",
        presentation: {
          reasonCode: "CUSTOMER_REPLY_DRAFT_REQUIRED",
          requiredCapability: "case.reply.prepare",
        },
      },
      priority: { reasonCode: "OVERDUE" },
      sourceTruth: { kind: "canonical" },
      target: { entity: "case", id: "case:20", version: "r2" },
      interaction: {
        mode: "executable",
        activation: { kind: "open_workbench" },
      },
    });
  });

  it("never projects an inline mutation from case-list data", () => {
    const result = projectAdminCaseListWorkQueue(
      projectionInput([row(1), row(2), row(3)]),
    );

    for (const item of result.items) {
      expect(item.interaction).toEqual({
        mode: "executable",
        activation: { kind: "open_workbench" },
      });
      expect(JSON.stringify(item.interaction)).not.toContain("commandId");
      expect(JSON.stringify(item.interaction)).not.toContain("idempotencyKey");
    }
  });

  it("fails closed when a non-case action has no exact target", () => {
    expectAdapterError(
      () =>
        projectAdminCaseListWorkQueue(
          projectionInput([
            row(7, {
              item: caseItem(7, { nextAction: "assign_worker" }),
            }),
          ]),
        ),
      "MISSING_EXACT_TARGET",
    );
  });

  it("uses a non-executable case recovery target when no sub-entity route consumes the identity", () => {
    const result = projectAdminCaseListWorkQueue(
      projectionInput([
        row(7, {
          exactTargetAvailable: false,
          item: caseItem(7, { nextAction: "assign_worker" }),
        }),
      ]),
    );

    expect(result.items[0]).toMatchObject({
      interaction: { mode: "read_only", reason: "target_unavailable" },
      target: {
        availability: "case_recovery",
        entity: "case",
        href: "/admin-v2/cases/7",
        id: "case:7",
      },
    });
  });

  it("projects exact targets and waiting ownership without a CTA", () => {
    const result = projectAdminCaseListWorkQueue(
      projectionInput([
        row(43, {
          item: caseItem(43, {
            nextAction: "wait_customer",
            dueAt: undefined,
          }),
          ownerId: "customer:43",
          wakeAt: "2026-09-05T12:00:00+02:00",
          exactTarget: {
            entity: "quote",
            id: "quote:91",
            version: "v3",
            href: "/admin-v2/cases/43?target=quote%3A91",
          },
        }),
      ]),
    );
    const item = result.items[0];

    expect(item.owner).toEqual({ id: "customer:43", party: "customer" });
    expect(item.target).toMatchObject({ entity: "quote", id: "quote:91" });
    expect(item.timing.wakeAt).toBe("2026-09-05T10:00:00.000Z");
    expect(item.interaction).toEqual({
      mode: "waiting",
      waitingParty: "customer",
    });
    expect(item.action.presentation.copy.cta).toBeNull();
  });

  it("keeps shadow reads read-only and accepts Preview operator targets", () => {
    const result = projectAdminCaseListWorkQueue(
      projectionInput(
        [
          row(55, {
            item: caseItem(55, {
              href: "/admin-next-preview/cases/55",
            }),
          }),
        ],
        { sourceKind: "shadow_read" },
      ),
    );

    expect(result.items[0]).toMatchObject({
      case: { href: "/admin-next-preview/cases/55" },
      sourceTruth: { kind: "shadow_read" },
      interaction: { mode: "read_only", reason: "source_not_canonical" },
    });
  });

  it("fails closed for missing revision, waiting owner and inactive cases", () => {
    expectAdapterError(
      () =>
        projectAdminCaseListWorkQueue(
          projectionInput([row(1, { caseRevision: null })]),
        ),
      "MISSING_CASE_REVISION",
    );
    expectAdapterError(
      () =>
        projectAdminCaseListWorkQueue(
          projectionInput([
            row(2, {
              item: caseItem(2, { nextAction: "wait_customer" }),
              ownerId: null,
              exactTarget: {
                entity: "quote",
                id: "quote:2",
                version: "v1",
                href: "/admin-v2/cases/2?target=quote%3A2",
              },
            }),
          ]),
        ),
      "MISSING_OWNER_ID",
    );
    expectAdapterError(
      () =>
        projectAdminCaseListWorkQueue(
          projectionInput([
            row(3, {
              item: caseItem(3, { recordState: "archived" }),
            }),
          ]),
        ),
      "INACTIVE_CASE",
    );
  });

  it("rejects conflicting projections of the same case revision", () => {
    expectAdapterError(
      () =>
        projectAdminCaseListWorkQueue(
          projectionInput([
            row(8, {
              item: caseItem(8, { dueAt: "2026-09-05T10:00:00Z" }),
            }),
            row(8, {
              item: caseItem(8, { dueAt: "2026-09-06T10:00:00Z" }),
            }),
          ]),
        ),
      "DUPLICATE_REVISION_CONFLICT",
    );
  });

  it("applies canonical query filters after stable sorting", () => {
    const result = projectAdminCaseListWorkQueue(
      projectionInput(
        [
          row(1, {
            item: caseItem(1, { dueAt: "2026-09-03T10:00:00Z" }),
          }),
          row(2, {
            item: caseItem(2, { dueAt: "2026-09-05T10:00:00Z" }),
          }),
        ],
        { query: query("view=today&queue=overdue&limit=25") },
      ),
    );

    expect(result.items.map((item) => item.case.id)).toEqual(["case:1"]);
  });

  it("returns cursor pagination and requires a cursor before truncation", () => {
    const limitedQuery = query("view=today&queue=all&limit=1");
    expectAdapterError(
      () =>
        projectAdminCaseListWorkQueue(
          projectionInput([row(1), row(2)], { query: limitedQuery }),
        ),
      "MISSING_NEXT_CURSOR",
    );

    const nextCursor = parseWorkQueueCursor("wq1_Y2FzZToyOnJldmlzaW9uOjE");
    const result = projectAdminCaseListWorkQueue(
      projectionInput([row(1), row(2)], {
        query: limitedQuery,
        nextCursor,
      }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.pageInfo).toEqual({
      limit: 1,
      hasNextPage: true,
      nextCursor,
    });
  });

  it("computes totalItems and filter facets from the filtered batch before pagination", () => {
    const limitedQuery = query("view=today&queue=all&limit=1");
    const nextCursor = parseWorkQueueCursor("wq1_ZmFjZXRzLW5leHQtcGFnZQ");
    const result = projectAdminCaseListWorkQueue(
      projectionInput(
        [
          row(1, {
            item: caseItem(1, { nextAction: "generate_reply" }),
            ownerId: "admin:7",
          }),
          row(2, {
            item: caseItem(2, { nextAction: "prepare_package" }),
            ownerId: "admin:8",
          }),
        ],
        { query: limitedQuery, nextCursor },
      ),
    );

    expect(result.items).toHaveLength(1);
    expect(result.totalItems).toBe(2);
    expect(result.facets).toEqual({
      actionKinds: [
        { count: 1, value: "generate_reply" },
        { count: 1, value: "prepare_package" },
      ],
      owners: [
        { count: 1, id: "admin:7", party: "administrator" },
        { count: 1, id: "admin:8", party: "administrator" },
      ],
      processStages: [
        { count: 1, value: "evidence" },
        { count: 1, value: "inquiry" },
      ],
    });
  });

  it("fails closed when the mine filter has no stable current user", () => {
    expectAdapterError(
      () =>
        projectAdminCaseListWorkQueue(
          projectionInput([row(1)], {
            query: query("view=today&queue=mine&limit=25"),
            currentUserId: null,
          }),
        ),
      "MISSING_CURRENT_USER",
    );
  });
});
