export type NewOperationalJob = {
  type: string;
  idempotencyKey: string;
  correlationId: string;
  maxAttempts?: number;
  availableAt?: string;
  payload?: Record<string, unknown>;
};

export type StoredOperationalJob = NewOperationalJob & {
  id: string | number;
  status:
    | "pending"
    | "running"
    | "retry"
    | "completed"
    | "failed"
    | "attention"
    | "cancelled";
  attempts: number;
};

export interface OperationalJobRepository {
  findByIdempotencyKey(key: string): Promise<StoredOperationalJob | null>;
  create(job: NewOperationalJob): Promise<StoredOperationalJob>;
}

function validateJob(job: NewOperationalJob) {
  if (!/^[a-z][a-z0-9._-]{1,99}$/.test(job.type)) {
    throw new TypeError("Job type is invalid");
  }
  if (!job.idempotencyKey || job.idempotencyKey.length > 200) {
    throw new TypeError("Job idempotency key is invalid");
  }
  if (!/^[a-zA-Z0-9._:-]{8,100}$/.test(job.correlationId)) {
    throw new TypeError("Job correlation ID is invalid");
  }
  if (job.maxAttempts !== undefined) {
    if (
      !Number.isInteger(job.maxAttempts) ||
      job.maxAttempts < 1 ||
      job.maxAttempts > 10
    ) {
      throw new TypeError("Job max attempts must be between 1 and 10");
    }
  }
}

export async function enqueueOperationalJob(
  repository: OperationalJobRepository,
  job: NewOperationalJob,
) {
  validateJob(job);
  const existing = await repository.findByIdempotencyKey(job.idempotencyKey);
  if (existing) return { created: false, job: existing } as const;
  const created = await repository.create(job);
  return { created: true, job: created } as const;
}
