import { describe, expect, it } from "vitest";
import type { CreateWorkQueueItemInput } from "./work-queue-contract";
import {
  canonicalWorkQueueUrl,
  createWorkQueueItem,
  createWorkQueuePage,
  parseCanonicalWorkQueueQuery,
  parseWorkQueueCursor,
  WorkQueueContractError,
} from "./work-queue-contract";

const now = new Date("2026-09-04T10:00:00.000Z");

function executableInput(
  overrides: Partial<CreateWorkQueueItemInput> = {},
): CreateWorkQueueItemInput {
  return {
    case: {
      customerName: "  Ada Nordmann  ",
      id: "case:42",
      postalAddress: "  Testveien 42, 0001 Oslo  ",
      revision: 7,
      reference: "TF-42",
      href: "/admin-v2/cases/42",
    },
    locale: "lt",
    actionKind: "generate_reply",
    owner: { id: "admin:7", party: "administrator" },
    timing: { dueAt: "2026-09-04T12:00:00+02:00", wakeAt: null },
    blockers: [],
    capabilityGranted: true,
    target: {
      entity: "case",
      id: "case:42",
      version: "r7",
      href: "/admin-v2/cases/42",
    },
    sourceTruth: {
      kind: "canonical",
      resolver: "deriveCaseNextAction",
      contractVersion: "f2-v1",
      derivedAt: "2026-09-04T12:00:00+02:00",
    },
    interaction: {
      mode: "executable",
      activation: {
        kind: "inline_command",
        commandId: "lead.generate_reply",
        idempotencyKey: "case42-generate-0001",
        expectedCaseRevision: 7,
      },
    },
    ...overrides,
  };
}

function waitingInput(): CreateWorkQueueItemInput {
  return {
    case: {
      id: "case:43",
      revision: 3,
      reference: "TF-43",
      href: "/admin-v2/cases/43",
    },
    locale: "en",
    actionKind: "wait_customer",
    owner: { id: "customer:43", party: "customer" },
    timing: {
      dueAt: null,
      wakeAt: "2026-09-05T12:00:00+02:00",
    },
    blockers: [],
    capabilityGranted: true,
    target: {
      entity: "quote",
      id: "quote:91",
      version: "v3",
      href: "/admin-v2/cases/43?target=quote%3A91",
    },
    sourceTruth: {
      kind: "canonical",
      resolver: "deriveCaseNextAction",
      contractVersion: "f2-v1",
      derivedAt: now.toISOString(),
    },
    interaction: { mode: "waiting", waitingParty: "customer" },
  };
}

function expectContractError(
  callback: () => unknown,
  code: WorkQueueContractError["code"],
) {
  try {
    callback();
    throw new Error("Expected WorkQueueContractError");
  } catch (error) {
    expect(error).toBeInstanceOf(WorkQueueContractError);
    expect((error as WorkQueueContractError).code).toBe(code);
  }
}

describe("Admin Next work queue contract", () => {
  it("combines stable case identity, localized presentation and priority dimensions", () => {
    const item = createWorkQueueItem(executableInput(), now);

    expect(item).toMatchObject({
      contractVersion: "f2-v1",
      case: {
        customerName: "Ada Nordmann",
        id: "case:42",
        postalAddress: "Testveien 42, 0001 Oslo",
        revision: 7,
        reference: "TF-42",
      },
      locale: "lt",
      action: {
        kind: "generate_reply",
        presentation: {
          processStage: "inquiry",
          reasonCode: "CUSTOMER_REPLY_DRAFT_REQUIRED",
          requiredCapability: "case.reply.prepare",
          target: { entity: "case" },
          copy: { cta: "Sukurti DI atsakymo juodraštį" },
        },
      },
      owner: { id: "admin:7", party: "administrator" },
      authorization: {
        requiredCapability: "case.reply.prepare",
        granted: true,
      },
      sourceTruth: {
        kind: "canonical",
        resolver: "deriveCaseNextAction",
        derivedAt: "2026-09-04T10:00:00.000Z",
      },
    });
    expect(item.timing).toEqual({
      dueAt: "2026-09-04T10:00:00.000Z",
      wakeAt: null,
    });
    expect(item.priority).toMatchObject({
      dueAt: "2026-09-04T10:00:00.000Z",
      reasonCode: "OVERDUE",
      slaBand: "overdue",
    });
  });

  it("represents unavailable customer identity fields as explicit unknowns", () => {
    const input = executableInput();
    input.case.customerName = "  ";
    input.case.postalAddress = undefined;

    expect(createWorkQueueItem(input, now).case).toMatchObject({
      customerName: null,
      postalAddress: null,
    });
  });

  it("keeps waiting read-only, with a full UTC wake instant and named party", () => {
    const item = createWorkQueueItem(waitingInput(), now);

    expect(item.interaction).toEqual({
      mode: "waiting",
      waitingParty: "customer",
    });
    expect(item.action.presentation.copy.cta).toBeNull();
    expect(item.timing).toEqual({
      dueAt: null,
      wakeAt: "2026-09-05T10:00:00.000Z",
    });
    expect(item.priority).toMatchObject({
      waitingParty: "customer",
      wakeAt: "2026-09-05T10:00:00.000Z",
      reasonCode: "WAITING_NOT_DUE",
    });
    expect(item.interaction).not.toHaveProperty("activation");
  });

  it("represents denied access as read-only without a command surface", () => {
    const input = executableInput({
      capabilityGranted: false,
      interaction: { mode: "read_only", reason: "capability_denied" },
    });
    const item = createWorkQueueItem(input, now);

    expect(item.authorization).toEqual({
      requiredCapability: "case.reply.prepare",
      granted: false,
    });
    expect(item.interaction).toEqual({
      mode: "read_only",
      reason: "capability_denied",
    });
    expect(item.interaction).not.toHaveProperty("activation");
  });

  it("requires idempotency and matching CAS revision for inline commands", () => {
    const withoutIdempotency = executableInput();
    withoutIdempotency.interaction = {
      mode: "executable",
      activation: {
        kind: "inline_command",
        commandId: "lead.generate_reply",
        idempotencyKey: "short",
        expectedCaseRevision: 7,
      },
    };
    expectContractError(
      () => createWorkQueueItem(withoutIdempotency, now),
      "IDEMPOTENCY_KEY_REQUIRED",
    );

    const staleRevision = executableInput();
    staleRevision.interaction = {
      mode: "executable",
      activation: {
        kind: "inline_command",
        commandId: "lead.generate_reply",
        idempotencyKey: "case42-generate-0001",
        expectedCaseRevision: 6,
      },
    };
    expectContractError(
      () => createWorkQueueItem(staleRevision, now),
      "REVISION_MISMATCH",
    );
  });

  it("fails closed for shadow execution, denied execution and semantic drift", () => {
    expectContractError(
      () =>
        createWorkQueueItem(
          executableInput({
            sourceTruth: {
              kind: "shadow_read",
              resolver: "deriveCaseNextAction",
              contractVersion: "f2-v1",
              derivedAt: now.toISOString(),
            },
          }),
          now,
        ),
      "EXECUTION_REQUIRES_CANONICAL_SOURCE",
    );
    expectContractError(
      () =>
        createWorkQueueItem(executableInput({ capabilityGranted: false }), now),
      "EXECUTION_REQUIRES_GRANTED_CAPABILITY",
    );
    expectContractError(
      () =>
        createWorkQueueItem(
          executableInput({
            target: {
              entity: "quote",
              id: "quote:1",
              version: "v1",
              href: "/admin-v2/cases/42?target=quote%3A1",
            },
          }),
          now,
        ),
      "TARGET_SEMANTICS_MISMATCH",
    );
    expectContractError(
      () =>
        createWorkQueueItem(
          executableInput({
            owner: { id: "worker:1", party: "worker" },
          }),
          now,
        ),
      "OWNER_PARTY_MISMATCH",
    );
  });

  it("permits a case recovery target only for a non-executable unavailable target", () => {
    const recovery = createWorkQueueItem(
      executableInput({
        actionKind: "assign_worker",
        capabilityGranted: false,
        interaction: { mode: "read_only", reason: "target_unavailable" },
        target: {
          availability: "case_recovery",
          entity: "case",
          href: "/admin-v2/cases/42",
          id: "case:42",
          version: "r7",
        },
      }),
      now,
    );
    expect(recovery.target.availability).toBe("case_recovery");
    expectContractError(
      () =>
        createWorkQueueItem(
          executableInput({
            actionKind: "assign_worker",
            target: {
              availability: "case_recovery",
              entity: "case",
              href: "/admin-v2/cases/42",
              id: "case:42",
              version: "r7",
            },
          }),
          now,
        ),
      "TARGET_SEMANTICS_MISMATCH",
    );
  });

  it("requires explicit blockers and projects them into priority dimensions", () => {
    const blockedInput = executableInput({
      actionKind: "retry_message",
      target: {
        entity: "message",
        id: "message:9",
        version: "v1",
        href: "/admin-v2/cases/42?target=message%3A9",
      },
      interaction: {
        mode: "executable",
        activation: {
          kind: "inline_command",
          commandId: "message.retry_send",
          idempotencyKey: "case42-message9-0001",
          expectedCaseRevision: 7,
        },
      },
    });
    expectContractError(
      () => createWorkQueueItem(blockedInput, now),
      "INVALID_BLOCKER",
    );

    blockedInput.blockers = [
      {
        code: "MESSAGE_DELIVERY_FAILED",
        source: { type: "message", id: "message:9" },
        owner: { id: "admin:7", party: "administrator" },
        resolution: "Retry the same message after reviewing provider failure.",
      },
    ];
    const item = createWorkQueueItem(blockedInput, now);

    expect(item.blockers).toHaveLength(1);
    expect(item.priority.transitionBlocked).toBe(true);
    expect(item.priority.reasonCode).toBe("TRANSITION_BLOCKED");
  });

  it("rejects non-canonical targets, invalid timestamps and fixture-like sources", () => {
    expectContractError(
      () =>
        createWorkQueueItem(
          executableInput({
            target: {
              entity: "case",
              id: "case:42",
              version: "r7",
              href: "/admin/collections/leads/42",
            },
          }),
          now,
        ),
      "INVALID_TARGET",
    );
    expectContractError(
      () =>
        createWorkQueueItem(
          executableInput({
            case: {
              id: "case:42",
              revision: 7,
              reference: "TF-42",
              href: "/admin",
            },
          }),
          now,
        ),
      "INVALID_CASE_ID",
    );
    expectContractError(
      () =>
        createWorkQueueItem(
          executableInput({ timing: { dueAt: "not-a-date" } }),
          now,
        ),
      "INVALID_UTC_INSTANT",
    );
    expectContractError(
      () =>
        createWorkQueueItem(
          executableInput({
            sourceTruth: {
              kind: "fixture",
              resolver: "deriveCaseNextAction",
              contractVersion: "f2-v1",
              derivedAt: now.toISOString(),
            } as never,
          }),
          now,
        ),
      "INVALID_SOURCE_TRUTH",
    );
  });

  it("accepts shadow data only as explicitly read-only", () => {
    const item = createWorkQueueItem(
      executableInput({
        capabilityGranted: true,
        sourceTruth: {
          kind: "shadow_read",
          resolver: "deriveCaseNextAction",
          contractVersion: "f2-v1",
          derivedAt: now.toISOString(),
        },
        interaction: { mode: "read_only", reason: "source_not_canonical" },
      }),
      now,
    );

    expect(item.sourceTruth.kind).toBe("shadow_read");
    expect(item.interaction).toEqual({
      mode: "read_only",
      reason: "source_not_canonical",
    });
  });

  it("round-trips the canonical query shape with an opaque cursor", () => {
    const cursor = parseWorkQueueCursor("wq1_MDEyMzQ1Njc4OWFiY2RlZg");
    const query = {
      view: "today",
      queue: "blocked",
      processStage: "work",
      actionKind: "resolve_work_block",
      ownerId: "admin:7",
      cursor,
      limit: 40,
    } as const;
    const url = canonicalWorkQueueUrl(query);

    expect(url).toBe(
      "/admin-v2?view=today&queue=blocked&stage=work&action=resolve_work_block&ownerId=admin%3A7&cursor=wq1_MDEyMzQ1Njc4OWFiY2RlZg&limit=40",
    );
    expect(parseCanonicalWorkQueueQuery(url.split("?")[1])).toEqual({
      ok: true,
      value: query,
    });
  });

  it.each([
    ["view=work", "INVALID_VIEW"],
    ["queue=urgent", "INVALID_QUEUE"],
    ["stage=offer", "INVALID_STAGE"],
    ["action=delete_everything", "INVALID_ACTION_KIND"],
    ["ownerId=two words", "INVALID_OWNER_ID"],
    ["cursor=plain-offset", "INVALID_CURSOR"],
    ["limit=0", "INVALID_LIMIT"],
    ["limit=101", "INVALID_LIMIT"],
    ["queue=all&queue=mine", "DUPLICATE_QUERY_VALUE"],
    ["unknown=value", "UNKNOWN_QUERY_KEY"],
  ])("fails closed for invalid query %s", (query, code) => {
    expect(parseCanonicalWorkQueueQuery(query)).toMatchObject({
      ok: false,
      code,
    });
  });

  it("builds cursor pagination and prevents duplicate cases or cursor loops", () => {
    const cursor = parseWorkQueueCursor("wq1_MDEyMzQ1Njc4OWFiY2RlZg");
    const nextCursor = parseWorkQueueCursor("wq1_ZmVkY2JhOTg3NjU0MzIxMA");
    const parsed = parseCanonicalWorkQueueQuery(
      `view=today&queue=all&cursor=${cursor}&limit=2`,
    );
    if (!parsed.ok) throw new Error("Expected valid query");
    const first = createWorkQueueItem(executableInput(), now);
    const second = createWorkQueueItem(waitingInput(), now);
    const page = createWorkQueuePage({
      query: parsed.value,
      items: [first, second],
      nextCursor,
    });

    expect(page.pageInfo).toEqual({
      limit: 2,
      hasNextPage: true,
      nextCursor,
    });
    expect(page.totalItems).toBe(2);
    expect(page.facets.actionKinds).toEqual([
      { count: 1, value: "generate_reply" },
      { count: 1, value: "wait_customer" },
    ]);
    expectContractError(
      () =>
        createWorkQueuePage({
          query: parsed.value,
          items: [first, first],
          nextCursor,
        }),
      "DUPLICATE_CASE",
    );
    expectContractError(
      () =>
        createWorkQueuePage({
          query: parsed.value,
          items: [first],
          nextCursor: cursor,
        }),
      "CURSOR_LOOP",
    );
  });

  it("produces a JSON-serializable page without Date values", () => {
    const parsed = parseCanonicalWorkQueueQuery("view=today&limit=25");
    if (!parsed.ok) throw new Error("Expected valid query");
    const page = createWorkQueuePage({
      query: parsed.value,
      items: [createWorkQueueItem(executableInput(), now)],
      nextCursor: null,
    });
    const serialized = JSON.stringify(page);
    const roundTrip = JSON.parse(serialized) as unknown;

    expect(roundTrip).toEqual(page);
    expect(serialized).not.toContain("[object Date]");
    expect(page.pageInfo).toEqual({
      limit: 25,
      hasNextPage: false,
      nextCursor: null,
    });
    expect(page.totalItems).toBe(1);
    expect(page.facets).toMatchObject({
      actionKinds: [{ count: 1, value: "generate_reply" }],
      owners: [{ count: 1, id: "admin:7", party: "administrator" }],
      processStages: [{ count: 1, value: "inquiry" }],
    });
  });

  it("keeps one owner facet when the same user serves multiple case roles", () => {
    const parsed = parseCanonicalWorkQueueQuery("view=today&limit=25");
    if (!parsed.ok) throw new Error("Expected valid query");
    const first = createWorkQueueItem(
      executableInput({ owner: { id: "user:7", party: "administrator" } }),
      now,
    );
    const second = createWorkQueueItem(
      {
        ...waitingInput(),
        actionKind: "wait_work_completion",
        owner: { id: "user:7", party: "worker" },
        target: {
          entity: "work_order",
          id: "work-order:43",
          version: "v2",
          href: "/admin-v2/cases/43?target=work-order%3A43",
        },
        interaction: {
          mode: "waiting",
          waitingParty: "worker",
        },
      },
      now,
    );

    const page = createWorkQueuePage({
      query: parsed.value,
      items: [first, second],
      nextCursor: null,
    });

    expect(page.facets.owners).toEqual([
      { count: 2, id: "user:7", party: "mixed" },
    ]);
  });

  it("rejects non-serializable values and invalid runtime query casts", () => {
    const parsed = parseCanonicalWorkQueueQuery("view=today&limit=25");
    if (!parsed.ok) throw new Error("Expected valid query");
    const item = createWorkQueueItem(executableInput(), now);
    const withDate = {
      ...item,
      debug: new Date(),
    } as never;

    expectContractError(
      () =>
        createWorkQueuePage({
          query: parsed.value,
          items: [withDate],
          nextCursor: null,
        }),
      "INVALID_PAGE",
    );
    expectContractError(
      () => canonicalWorkQueueUrl({ ...parsed.value, limit: 0 }),
      "INVALID_PAGE",
    );
    expectContractError(
      () =>
        createWorkQueuePage({
          query: parsed.value,
          items: [item],
          nextCursor: null,
          totalItems: 0,
        }),
      "INVALID_PAGE",
    );
  });
});
