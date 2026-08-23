import type { Payload } from "payload";
import type {
  NewOperationalJob,
  OperationalJobRepository,
  StoredOperationalJob,
} from "./enqueue-job";

function toStoredJob(document: {
  id: string | number;
  type: string;
  idempotencyKey: string;
  correlationId: string;
  status: StoredOperationalJob["status"];
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  payload?: unknown;
}): StoredOperationalJob {
  return {
    id: document.id,
    type: document.type,
    idempotencyKey: document.idempotencyKey,
    correlationId: document.correlationId,
    status: document.status,
    attempts: document.attempts,
    maxAttempts: document.maxAttempts,
    availableAt: document.availableAt,
    ...(document.payload && typeof document.payload === "object"
      ? { payload: document.payload as Record<string, unknown> }
      : {}),
  };
}

export function createPayloadJobRepository(
  payload: Payload,
): OperationalJobRepository {
  return {
    async findByIdempotencyKey(key) {
      const result = await payload.find({
        collection: "operational-jobs",
        where: { idempotencyKey: { equals: key } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      return result.docs[0] ? toStoredJob(result.docs[0]) : null;
    },
    async create(job: NewOperationalJob) {
      const document = await payload.create({
        collection: "operational-jobs",
        data: {
          type: job.type,
          idempotencyKey: job.idempotencyKey,
          correlationId: job.correlationId,
          status: "pending",
          attempts: 0,
          maxAttempts: job.maxAttempts ?? 3,
          availableAt: job.availableAt ?? new Date().toISOString(),
          ...(job.payload ? { payload: job.payload } : {}),
        },
        overrideAccess: true,
      });
      return toStoredJob(document);
    },
  };
}
