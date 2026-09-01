import { describe, expect, it, vi } from "vitest";
import {
  claimCommercialPackageRequest,
  completeCommercialPackageRequest,
  failCommercialPackageRequest,
} from "./commercial-package-request";

function repository() {
  const jobs: Array<Record<string, unknown>> = [];
  let nextId = 1;
  return {
    jobs,
    payload: {
      find: vi.fn(
        async ({
          where,
        }: {
          where: { idempotencyKey: { equals: string } };
        }) => ({
          docs: jobs.filter(
            (job) => job.idempotencyKey === where.idempotencyKey.equals,
          ),
        }),
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (jobs.some((job) => job.idempotencyKey === data.idempotencyKey))
          throw new Error("duplicate key");
        const job = { id: nextId++, ...data };
        jobs.push(job);
        return job;
      }),
      update: vi.fn(
        async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
          const job = jobs.find((item) => item.id === id);
          if (!job) throw new Error("missing job");
          Object.assign(job, data);
          return job;
        },
      ),
    },
  };
}

const input = {
  administratorId: 9,
  correlationId: "commercial-test",
  leadId: 12,
  requestKey: "a2cc6d27-9977-41a7-af73-50d5bda1ef25",
  now: new Date("2026-09-01T08:00:00.000Z"),
};

describe("commercial package request idempotency", () => {
  it("claims once and returns the original completed result on retry", async () => {
    const repo = repository();
    const first = await claimCommercialPackageRequest(
      repo.payload as never,
      input,
    );
    expect(first).toEqual({ kind: "claimed", jobId: 1 });
    expect(repo.jobs).toHaveLength(1);

    await completeCommercialPackageRequest(
      repo.payload as never,
      1,
      {
        baseQuoteId: 21,
        baseQuoteReference: "T-12-V2",
        recommendedQuoteId: 22,
        recommendedQuoteReference: "T-12-V3",
      },
      input.now,
    );

    const repeated = await claimCommercialPackageRequest(
      repo.payload as never,
      input,
    );
    expect(repeated).toEqual({
      kind: "completed",
      result: {
        baseQuoteId: 21,
        baseQuoteReference: "T-12-V2",
        recommendedQuoteId: 22,
        recommendedQuoteReference: "T-12-V3",
      },
    });
    expect(repo.payload.create).toHaveBeenCalledTimes(1);
  });

  it("reports an existing running request instead of creating a duplicate", async () => {
    const repo = repository();
    await claimCommercialPackageRequest(repo.payload as never, input);
    await expect(
      claimCommercialPackageRequest(repo.payload as never, input),
    ).resolves.toEqual({ kind: "processing" });
    expect(repo.payload.create).toHaveBeenCalledTimes(1);
  });

  it("turns a failed attempt into an attention record that cannot silently retry", async () => {
    const repo = repository();
    await claimCommercialPackageRequest(repo.payload as never, input);
    await failCommercialPackageRequest(
      repo.payload as never,
      1,
      new Error("safe failure\nwith detail"),
    );
    await expect(
      claimCommercialPackageRequest(repo.payload as never, input),
    ).resolves.toEqual({ kind: "failed" });
    expect(repo.jobs[0]).toMatchObject({
      status: "attention",
      lastErrorCode: "commercial_package_rebuild_failed",
      lastErrorMessage: "safe failure with detail",
    });
  });

  it("recovers a unique-key race as processing", async () => {
    const repo = repository();
    repo.payload.find
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [{ id: 8, status: "running", result: null }],
      });
    repo.payload.create.mockRejectedValueOnce(new Error("duplicate key"));
    await expect(
      claimCommercialPackageRequest(repo.payload as never, input),
    ).resolves.toEqual({ kind: "processing" });
  });
});
