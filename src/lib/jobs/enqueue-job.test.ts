import { describe, expect, it, vi } from "vitest";
import {
  enqueueOperationalJob,
  type OperationalJobRepository,
  type StoredOperationalJob,
} from "./enqueue-job";

const stored: StoredOperationalJob = {
  id: 1,
  type: "lead.receipt",
  idempotencyKey: "lead:1:receipt",
  correlationId: "corr-12345678",
  status: "pending",
  attempts: 0,
};

describe("enqueue operational job", () => {
  it("returns an existing logical job without creating a duplicate", async () => {
    const repository: OperationalJobRepository = {
      findByIdempotencyKey: vi.fn(async () => stored),
      create: vi.fn(async () => stored),
    };
    const result = await enqueueOperationalJob(repository, stored);
    expect(result.created).toBe(false);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("creates the first job", async () => {
    const repository: OperationalJobRepository = {
      findByIdempotencyKey: vi.fn(async () => null),
      create: vi.fn(async () => stored),
    };
    const result = await enqueueOperationalJob(repository, stored);
    expect(result.created).toBe(true);
    expect(repository.create).toHaveBeenCalledOnce();
  });
});
