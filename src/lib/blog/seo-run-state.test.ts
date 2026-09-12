import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./post-write-transaction", () => ({
  withSeoPayloadTransaction: (
    payload: unknown,
    work: (p: unknown) => unknown,
  ) => work(payload),
}));
import { claimSeoRun } from "./seo-run-state";
const now = new Date("2026-09-14T09:00:00Z");
describe("run reconciliation", () => {
  let prior: Record<string, unknown> | null;
  let post: Record<string, unknown> | null;
  const update = vi.fn(async ({ data, id }) => ({ ...prior, id, ...data }));
  const create = vi.fn(async ({ data }) => ({ id: 7, ...data }));
  const payload = {
    find: vi.fn(async ({ collection }) => ({
      docs:
        collection === "posts" ? (post ? [post] : []) : prior ? [prior] : [],
    })),
    update,
    create,
  } as never;
  beforeEach(() => {
    prior = null;
    post = null;
    update.mockClear();
    create.mockClear();
  });
  it("reports running duplicate as busy", async () => {
    prior = { id: 7, status: "running", startedAt: now.toISOString() };
    expect(
      (
        await claimSeoRun(
          payload,
          { idempotencyKey: "slot", triggerSource: "cron" },
          now,
        )
      ).outcome,
    ).toBe("busy");
    expect(create).not.toHaveBeenCalled();
  });
  it("does not regenerate after an ambiguous stale provider run", async () => {
    prior = { id: 7, status: "running", startedAt: "2026-09-14T08:00:00Z" };
    expect(
      (
        await claimSeoRun(
          payload,
          { idempotencyKey: "slot", triggerSource: "cron" },
          now,
        )
      ).outcome,
    ).toBe("attention");
    expect(create).not.toHaveBeenCalled();
  });
  it("recovers a durable post before considering retry", async () => {
    prior = {
      id: 7,
      status: "failed",
      startedAt: "2026-09-14T08:00:00Z",
      errorCode: "PRE_PROVIDER_RETRY",
    };
    post = { id: 8 };
    const result = await claimSeoRun(
      payload,
      { idempotencyKey: "slot", triggerSource: "cron" },
      now,
    );
    expect(result.claimed).toBe(false);
    expect(result.outcome).toBe("recovered");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdPost: 8, status: "completed" }),
      }),
    );
  });
  it("bounds pre-provider retries and respects backoff", async () => {
    prior = {
      id: 7,
      status: "failed",
      startedAt: "2026-09-14T08:00:00Z",
      finishedAt: "2026-09-14T08:59:00Z",
      errorCode: "PRE_PROVIDER_RETRY",
      qualityResult: { kind: "seo-orchestration-v1", attempt: 1 },
    };
    expect(
      (
        await claimSeoRun(
          payload,
          { idempotencyKey: "slot", triggerSource: "cron" },
          now,
        )
      ).claimed,
    ).toBe(false);
    prior.finishedAt = "2026-09-14T08:00:00Z";
    expect(
      (
        await claimSeoRun(
          payload,
          { idempotencyKey: "slot", triggerSource: "cron" },
          now,
        )
      ).claimed,
    ).toBe(true);
    prior.qualityResult = { kind: "seo-orchestration-v1", attempt: 3 };
    expect(
      (
        await claimSeoRun(
          payload,
          { idempotencyKey: "slot", triggerSource: "cron" },
          now,
        )
      ).claimed,
    ).toBe(false);
  });
});
