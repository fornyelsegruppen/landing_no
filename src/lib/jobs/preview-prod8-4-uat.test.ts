import { describe, expect, it, vi } from "vitest";
import {
  recordProd84NoSendProbe,
  validProd84NoSendProbe,
} from "./preview-prod8-4-uat";

type Row = Record<string, unknown> & { id: number };

function repository() {
  const rows: Row[] = [];
  const payload = {
    find: vi.fn(
      async ({
        collection,
        where,
      }: {
        collection: string;
        where?: unknown;
      }) => {
        if (collection !== "operational-jobs") {
          throw new Error(`Unexpected collection access: ${collection}`);
        }
        const key = (
          where as { idempotencyKey?: { equals?: string } } | undefined
        )?.idempotencyKey?.equals;
        return { docs: rows.filter((row) => row.idempotencyKey === key) };
      },
    ),
    create: vi.fn(
      async ({
        collection,
        data,
      }: {
        collection: string;
        data: Record<string, unknown>;
      }) => {
        if (collection !== "operational-jobs") {
          throw new Error(`Unexpected collection access: ${collection}`);
        }
        const created = { id: rows.length + 41, ...structuredClone(data) };
        rows.push(created);
        return structuredClone(created);
      },
    ),
  };
  return { payload, rows };
}

describe("Preview PROD-8.4 no-send probe", () => {
  it("validates opaque probes without accepting empty or user-data-shaped values", () => {
    expect(validProd84NoSendProbe("prod84_20260829_A1b2C3")).toBe(true);
    expect(validProd84NoSendProbe(null)).toBe(false);
    expect(validProd84NoSendProbe("short")).toBe(false);
    expect(validProd84NoSendProbe("customer@example.test")).toBe(false);
  });

  it("creates one immediately completed marker and reuses it idempotently", async () => {
    const state = repository();
    const rawProbe = "prod84_20260829_A1b2C3";
    const now = new Date("2026-08-29T20:00:00.000Z");

    const first = await recordProd84NoSendProbe(
      state.payload as never,
      rawProbe,
      now,
    );
    const second = await recordProd84NoSendProbe(
      state.payload as never,
      rawProbe,
      now,
    );

    expect(first).toEqual({ duplicate: false, probeId: 41 });
    expect(second).toEqual({ duplicate: true, probeId: 41 });
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({
      type: "uat.no-send",
      status: "completed",
      attempts: 1,
      maxAttempts: 1,
      availableAt: now.toISOString(),
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      payload: { probeType: "prod8-4-no-send" },
      result: {
        noSend: true,
        probeDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(JSON.stringify(state.rows)).not.toContain(rawProbe);
    expect(state.payload.create).toHaveBeenCalledTimes(1);
  });

  it("recovers the existing marker after a concurrent unique-key winner", async () => {
    const winner: Row = {
      id: 77,
      idempotencyKey:
        "uat.prod8-4.no-send:49a1b6043a2e53dc90fc1a0b2b3cb1d88d732b2fbf4d87179de898043579e8ea",
    };
    let findCalls = 0;
    const payload = {
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection !== "operational-jobs")
          throw new Error("unexpected collection");
        findCalls += 1;
        return { docs: findCalls === 1 ? [] : [winner] };
      }),
      create: vi.fn(async () => {
        throw new Error("unique constraint violation");
      }),
    };

    const result = await recordProd84NoSendProbe(
      payload as never,
      "prod84_20260829_race_A1",
      new Date("2026-08-29T20:00:00.000Z"),
    );

    expect(result).toEqual({ duplicate: true, probeId: 77 });
    expect(payload.create).toHaveBeenCalledTimes(1);
    expect(payload.find).toHaveBeenCalledTimes(2);
  });
});
