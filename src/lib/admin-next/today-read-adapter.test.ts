import type { Payload } from "payload";
import { describe, expect, it, vi } from "vitest";
import { parseCanonicalWorkQueueQuery } from "./work-queue-contract";
import {
  createAdminNextCanonicalTodayAdapter,
  TODAY_WORK_QUEUE_CURSOR_MAX_LENGTH,
  TodayReadAdapterError,
} from "./today-read-adapter";

const osloBoundaryNow = new Date("2026-09-04T21:59:59.000Z");

type CollectionData = Record<string, readonly Record<string, unknown>[]>;

function payloadFor(data: CollectionData) {
  const find = vi.fn(async ({ collection }: { collection: string }) => ({
    docs: [...(data[collection] || [])],
    totalDocs: data[collection]?.length || 0,
  }));
  return { payload: { find } as unknown as Pick<Payload, "find">, find };
}

function lead(
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    name: `Customer ${id}`,
    address: `Testveien ${id}`,
    city: "Oslo",
    inquiryType: "takvask",
    status: "new",
    recordState: "active",
    caseRevision: 1,
    assignedTo: { id: 5, displayName: "Marius" },
    ...overrides,
  };
}

function query(value: string) {
  const result = parseCanonicalWorkQueueQuery(value);
  if (!result.ok) throw new Error(`Invalid test query: ${result.code}`);
  return result.value;
}

describe("canonical Today Work Queue read", () => {
  it("deduplicates a case to its latest stable revision", async () => {
    const { payload } = payloadFor({
      leads: [
        lead(7, {
          caseRevision: 1,
          nextActionAt: "2026-09-03T10:00:00.000Z",
        }),
        lead(7, {
          caseRevision: 3,
          nextActionAt: "2026-09-05T10:00:00.000Z",
        }),
      ],
    });

    const result = await createAdminNextCanonicalTodayAdapter(
      payload,
      "Marius",
      {
        currentUserId: "user:5",
        grantedCapabilities: ["case.reply.prepare"],
        now: () => new Date("2026-09-04T10:00:00.000Z"),
      },
    ).load();

    expect(result.workQueue?.items).toHaveLength(1);
    expect(result.workQueue?.items[0]).toMatchObject({
      case: {
        customerName: "Customer 7",
        id: "case:7",
        postalAddress: "Testveien 7 Oslo",
        revision: 3,
      },
      priority: { slaBand: "future" },
    });
    expect(result.value[0].workQueueItem).toBe(result.workQueue?.items[0]);
  });

  it("classifies the exact Europe/Oslo day and overdue boundaries", async () => {
    const { payload } = payloadFor({
      leads: [
        lead(1, { nextActionAt: "2026-09-04T21:59:59.000Z" }),
        lead(2, { nextActionAt: "2026-09-04T21:59:59.500Z" }),
        lead(3, { nextActionAt: "2026-09-04T22:00:00.000Z" }),
      ],
    });

    const result = await createAdminNextCanonicalTodayAdapter(payload, "", {
      now: () => osloBoundaryNow,
    }).load();
    const byId = new Map(
      result.workQueue?.items.map((item) => [item.case.id, item]) || [],
    );

    expect(byId.get("case:1")?.priority).toMatchObject({
      reasonCode: "OVERDUE",
      slaBand: "overdue",
    });
    expect(byId.get("case:2")?.priority).toMatchObject({
      reasonCode: "DUE_TODAY",
      slaBand: "due_today",
    });
    expect(byId.get("case:3")?.priority).toMatchObject({
      reasonCode: "FUTURE_ACTION",
      slaBand: "future",
    });
  });

  it("keeps waiting separate and gates executable work by capability", async () => {
    const data = {
      leads: [lead(10), lead(12, { nextActionAt: "2026-09-05T08:00:00Z" })],
      "roof-measurements": [{ id: 120, lead: 12, status: "approved" }],
      "price-calculations": [{ id: 121, lead: 12, status: "ready" }],
      quotes: [{ id: 122, lead: 12, status: "sent" }],
      messages: [
        {
          id: 123,
          lead: 12,
          direction: "outbound",
          category: "quote",
          status: "sent",
        },
      ],
    } satisfies CollectionData;
    const readOnly = await createAdminNextCanonicalTodayAdapter(
      payloadFor(data).payload,
      "Marius",
      {
        currentUserId: "user:5",
        locale: "lt",
        now: () => new Date("2026-09-04T10:00:00.000Z"),
      },
    ).load();
    const readOnlyById = new Map(
      readOnly.workQueue?.items.map((item) => [item.case.id, item]) || [],
    );

    expect(readOnlyById.get("case:10")?.interaction).toEqual({
      mode: "read_only",
      reason: "capability_denied",
    });
    expect(readOnlyById.get("case:10")?.authorization).toEqual({
      requiredCapability: "case.reply.prepare",
      granted: false,
    });
    expect(readOnlyById.get("case:10")?.action.presentation.copy.label).toBe(
      "Bylai reikia atsakymo juodraščio",
    );
    expect(readOnlyById.get("case:12")?.interaction).toEqual({
      mode: "waiting",
      waitingParty: "customer",
    });
    expect(readOnlyById.get("case:12")?.timing).toEqual({
      dueAt: null,
      wakeAt: "2026-09-05T08:00:00.000Z",
    });

    const executable = await createAdminNextCanonicalTodayAdapter(
      payloadFor(data).payload,
      "Marius",
      {
        currentUserId: "user:5",
        grantedCapabilities: ["case.reply.prepare"],
        now: () => new Date("2026-09-04T10:00:00.000Z"),
      },
    ).load();
    const action = executable.workQueue?.items.find(
      (item) => item.case.id === "case:10",
    );
    expect(action?.interaction).toEqual({
      mode: "executable",
      activation: { kind: "open_workbench" },
    });
    expect(action?.authorization.granted).toBe(true);
  });

  it("uses only consumed operator targets and degrades missing sub-targets to case recovery", async () => {
    const { payload } = payloadFor({
      leads: [lead(20)],
    });
    const result = await createAdminNextCanonicalTodayAdapter(payload, "", {
      now: () => new Date("2026-09-04T10:00:00.000Z"),
    }).load();

    for (const item of result.workQueue?.items || []) {
      expect(item.target.href).toMatch(
        /^\/(?:admin-v2|admin-next-preview)(?:[/?]|$)/u,
      );
      expect(item.target.href).not.toMatch(/^\/admin(?:[/?]|$)/u);
      expect(item.target.href).not.toMatch(/[?&](?:focus|target)=/u);
    }

    const missingTarget = payloadFor({
      leads: [
        lead(21, {
          nextActionBlocker: "CUSTOMER_CANCELLATION_REQUEST",
        }),
      ],
    }).payload;
    const missingTargetResult = await createAdminNextCanonicalTodayAdapter(
      missingTarget,
      "",
      {
        now: () => new Date("2026-09-04T10:00:00.000Z"),
      },
    ).load();
    expect(missingTargetResult.workQueue?.items[0]).toMatchObject({
      interaction: { mode: "read_only", reason: "diagnostic_blocker" },
      blockers: [
        {
          code: "CUSTOMER_CANCELLATION_REQUEST",
          source: { type: "case", id: "case:21" },
        },
      ],
      target: {
        availability: "case_recovery",
        entity: "case",
        href: "/admin-v2/cases/21",
        id: "case:21",
      },
    });
  });

  it("projects unmapped stored blockers as PII-safe, non-executable case recovery", async () => {
    const { payload } = payloadFor({
      leads: [
        lead(22, {
          nextActionBlocker: "WORK_WITHOUT_FULLY_SIGNED_CONTRACT",
        }),
        lead(23, {
          nextActionBlocker: "customer@example.invalid needs review",
        }),
      ],
    });
    const result = await createAdminNextCanonicalTodayAdapter(payload, "", {
      currentUserId: "user:5",
      grantedCapabilities: ["case.reply.prepare"],
      now: () => new Date("2026-09-04T10:00:00.000Z"),
    }).load();
    const byCase = new Map(
      result.workQueue?.items.map((item) => [item.case.id, item]) || [],
    );

    expect(byCase.get("case:22")).toMatchObject({
      interaction: { mode: "read_only", reason: "diagnostic_blocker" },
      priority: { hardStop: "integrity", transitionBlocked: true },
      target: {
        availability: "case_recovery",
        entity: "case",
        href: "/admin-v2/cases/22",
      },
      blockers: [
        {
          code: "WORK_WITHOUT_FULLY_SIGNED_CONTRACT",
          source: { type: "case", id: "case:22" },
        },
      ],
    });
    expect(byCase.get("case:23")?.blockers[0]).toMatchObject({
      code: "UNMAPPED_LEGACY_BLOCKER",
      source: { type: "case", id: "case:23" },
    });
    expect(JSON.stringify(result)).not.toContain("customer@example.invalid");
  });

  it("retains a safely mapped stored blocker with its exact related source", async () => {
    const { payload } = payloadFor({
      leads: [lead(24, { nextActionBlocker: "MESSAGE_DELIVERY_FAILED" })],
      messages: [
        {
          id: 241,
          lead: 24,
          direction: "outbound",
          failureCode: "MESSAGE_DELIVERY_FAILED",
          status: "failed",
        },
      ],
    });
    const result = await createAdminNextCanonicalTodayAdapter(payload, "", {
      now: () => new Date("2026-09-04T10:00:00.000Z"),
    }).load();

    expect(result.workQueue?.items[0]).toMatchObject({
      action: { kind: "retry_message" },
      blockers: [
        {
          code: "MESSAGE_DELIVERY_FAILED",
          source: { type: "message", id: "message:241" },
        },
      ],
    });
  });

  it("uses opaque cursors to page the deterministically sorted queue", async () => {
    const data = {
      leads: [lead(1), lead(2), lead(3)],
    } satisfies CollectionData;
    const first = await createAdminNextCanonicalTodayAdapter(
      payloadFor(data).payload,
      "",
      {
        now: () => new Date("2026-09-04T10:00:00.000Z"),
        query: query("view=today&queue=all&limit=2"),
      },
    ).load();
    expect(first.workQueue?.items.map((item) => item.case.id)).toEqual([
      "case:1",
      "case:2",
    ]);
    expect(first.workQueue?.pageInfo.hasNextPage).toBe(true);

    const secondQuery = query(
      `view=today&queue=all&limit=2&cursor=${first.workQueue?.pageInfo.nextCursor}`,
    );
    const second = await createAdminNextCanonicalTodayAdapter(
      payloadFor({ leads: [...data.leads].reverse() }).payload,
      "",
      { now: () => new Date("2026-09-04T10:00:00.000Z") },
    ).load(secondQuery);
    expect(second.workQueue?.items.map((item) => item.case.id)).toEqual([
      "case:3",
    ]);
    expect(second.workQueue?.pageInfo).toMatchObject({
      hasNextPage: false,
      nextCursor: null,
    });
  });

  it("keeps the first page prioritization instant across a due wake boundary", async () => {
    const data = {
      leads: [
        lead(1, { nextActionAt: "2026-09-04T10:00:00.500Z" }),
        lead(2),
        lead(3),
      ],
      "roof-measurements": [{ id: 101, lead: 1, status: "approved" }],
      "price-calculations": [{ id: 102, lead: 1, status: "ready" }],
      quotes: [{ id: 103, lead: 1, status: "sent" }],
      messages: [
        {
          id: 104,
          lead: 1,
          direction: "outbound",
          category: "quote",
          status: "sent",
        },
      ],
    } satisfies CollectionData;
    let requestNow = new Date("2026-09-04T10:00:00.000Z");
    const first = await createAdminNextCanonicalTodayAdapter(
      payloadFor(data).payload,
      "",
      { now: () => requestNow },
    ).load(query("view=today&queue=all&limit=2"));
    expect(first.workQueue?.items.map((item) => item.case.id)).toEqual([
      "case:2",
      "case:3",
    ]);
    const cursor = first.workQueue?.pageInfo.nextCursor;
    expect(cursor).toBeTruthy();

    requestNow = new Date("2026-09-04T10:00:01.000Z");
    const second = await createAdminNextCanonicalTodayAdapter(
      payloadFor(data).payload,
      "",
      { now: () => requestNow },
    ).load(query(`view=today&queue=all&limit=2&cursor=${cursor}`));

    expect(second.workQueue?.items.map((item) => item.case.id)).toEqual([
      "case:1",
    ]);
    expect(second.workQueue?.items[0]?.priority).toMatchObject({
      reasonCode: "WAITING_NOT_DUE",
      waitingWakeDue: false,
    });
    expect(second.workQueue?.items[0]?.sourceTruth.derivedAt).toBe(
      "2026-09-04T10:00:00.000Z",
    );
  });

  it("rejects a cursor when the canonical query without cursor changes", async () => {
    const data = {
      leads: [lead(1), lead(2), lead(3)],
    } satisfies CollectionData;
    const first = await createAdminNextCanonicalTodayAdapter(
      payloadFor(data).payload,
      "",
      { now: () => new Date("2026-09-04T10:00:00.000Z") },
    ).load(query("view=today&queue=all&limit=2"));
    const cursor = first.workQueue?.pageInfo.nextCursor;
    expect(cursor).toBeTruthy();

    await expect(
      createAdminNextCanonicalTodayAdapter(payloadFor(data).payload, "", {
        now: () => new Date("2026-09-04T10:00:00.000Z"),
      }).load(query(`view=today&queue=waiting&limit=2&cursor=${cursor}`)),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR_PAYLOAD" });
  });

  it("rejects a cursor when a latest case revision changes", async () => {
    const firstData = {
      leads: [lead(1), lead(2), lead(3)],
    } satisfies CollectionData;
    const first = await createAdminNextCanonicalTodayAdapter(
      payloadFor(firstData).payload,
      "",
      { now: () => new Date("2026-09-04T10:00:00.000Z") },
    ).load(query("view=today&queue=all&limit=2"));
    const cursor = first.workQueue?.pageInfo.nextCursor;

    const revisedData = {
      leads: [lead(1), lead(2, { caseRevision: 2 }), lead(3)],
    } satisfies CollectionData;
    await expect(
      createAdminNextCanonicalTodayAdapter(
        payloadFor(revisedData).payload,
        "",
        { now: () => new Date("2026-09-04T10:00:00.000Z") },
      ).load(query(`view=today&queue=all&limit=2&cursor=${cursor}`)),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR_PAYLOAD" });
  });

  it("rejects a cursor when visible customer identity changes", async () => {
    const firstData = {
      leads: [lead(1), lead(2), lead(3)],
    } satisfies CollectionData;
    const first = await createAdminNextCanonicalTodayAdapter(
      payloadFor(firstData).payload,
      "",
      { now: () => new Date("2026-09-04T10:00:00.000Z") },
    ).load(query("view=today&queue=all&limit=2"));
    const cursor = first.workQueue?.pageInfo.nextCursor;

    const changedData = {
      leads: [
        lead(1),
        lead(2, { name: "Changed Customer", postal: "0002" }),
        lead(3),
      ],
    } satisfies CollectionData;
    await expect(
      createAdminNextCanonicalTodayAdapter(
        payloadFor(changedData).payload,
        "",
        { now: () => new Date("2026-09-04T10:00:00.000Z") },
      ).load(query(`view=today&queue=all&limit=2&cursor=${cursor}`)),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR_PAYLOAD" });
  });

  it("rejects a mine cursor when the PII-free viewer scope changes", async () => {
    const data = {
      leads: [
        lead(1),
        lead(2),
        lead(3, { assignedTo: { id: 6, displayName: "Other" } }),
      ],
    } satisfies CollectionData;
    const first = await createAdminNextCanonicalTodayAdapter(
      payloadFor(data).payload,
      "",
      {
        currentUserId: "user:5",
        now: () => new Date("2026-09-04T10:00:00.000Z"),
      },
    ).load(query("view=today&queue=mine&limit=1"));
    const cursor = first.workQueue?.pageInfo.nextCursor;
    expect(cursor).toBeTruthy();

    await expect(
      createAdminNextCanonicalTodayAdapter(payloadFor(data).payload, "", {
        currentUserId: "user:6",
        now: () => new Date("2026-09-04T10:00:00.000Z"),
      }).load(query(`view=today&queue=mine&limit=1&cursor=${cursor}`)),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR_PAYLOAD" });
  });

  it("rejects a cursor whose offset was changed without its public checksum", async () => {
    const data = {
      leads: [lead(1), lead(2), lead(3)],
    } satisfies CollectionData;
    const first = await createAdminNextCanonicalTodayAdapter(
      payloadFor(data).payload,
      "",
      { now: () => new Date("2026-09-04T10:00:00.000Z") },
    ).load(query("view=today&queue=all&limit=2"));
    const cursor = first.workQueue?.pageInfo.nextCursor;
    if (!cursor) throw new Error("Expected a continuation cursor");
    const decoded = JSON.parse(
      Buffer.from(cursor.slice("wq1_".length), "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    decoded.o = 1;
    const tampered = `wq1_${Buffer.from(JSON.stringify(decoded)).toString("base64url")}`;

    await expect(
      createAdminNextCanonicalTodayAdapter(payloadFor(data).payload, "", {
        now: () => new Date("2026-09-04T10:00:00.000Z"),
      }).load(query(`view=today&queue=all&limit=2&cursor=${tampered}`)),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR_PAYLOAD" });
  });

  it("keeps the versioned cursor bounded and free of source PII", async () => {
    const data = {
      leads: [
        lead(1, {
          address: "Sensitive Street 1",
          email: "private@example.test",
          name: "Sensitive Customer",
        }),
        lead(2),
      ],
    } satisfies CollectionData;
    const first = await createAdminNextCanonicalTodayAdapter(
      payloadFor(data).payload,
      "",
      { now: () => new Date("2026-09-04T10:00:00.000Z") },
    ).load(query("view=today&queue=all&limit=1"));
    const cursor = first.workQueue?.pageInfo.nextCursor;
    if (!cursor) throw new Error("Expected a continuation cursor");
    const decodedText = Buffer.from(
      cursor.slice("wq1_".length),
      "base64url",
    ).toString("utf8");
    const decoded = JSON.parse(decodedText) as Record<string, unknown>;

    expect(cursor.length).toBeLessThanOrEqual(
      TODAY_WORK_QUEUE_CURSOR_MAX_LENGTH,
    );
    expect(Object.keys(decoded).sort()).toEqual([
      "i",
      "o",
      "q",
      "s",
      "t",
      "u",
      "v",
    ]);
    expect(decoded).toMatchObject({
      o: 1,
      t: "2026-09-04T10:00:00.000Z",
      v: 3,
    });
    expect(decoded.q).toMatch(/^[a-f0-9]{64}$/u);
    expect(decoded.s).toMatch(/^[a-f0-9]{64}$/u);
    expect(decoded.u).toMatch(/^[a-f0-9]{64}$/u);
    expect(decoded.i).toMatch(/^[a-f0-9]{64}$/u);
    expect(decodedText).not.toMatch(
      /Sensitive|private@example\.test|Street|Customer|user:5/u,
    );
  });

  it("fails closed when a syntactically valid cursor has an alien payload", async () => {
    const alien = query(
      "view=today&queue=all&limit=2&cursor=wq1_YWxpZW4tcGF5bG9hZC0xMjM0",
    );
    await expect(
      createAdminNextCanonicalTodayAdapter(payloadFor({}).payload).load(alien),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR_PAYLOAD" });
    await expect(
      createAdminNextCanonicalTodayAdapter(payloadFor({}).payload).load(alien),
    ).rejects.toBeInstanceOf(TodayReadAdapterError);
  });
});
