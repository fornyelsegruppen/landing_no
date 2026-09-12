import "server-only";
import type { Payload } from "payload";

export type AdminReadUser = {
  id: number;
  active: boolean;
  role: string;
} | null;

export type AdminReadConnection = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }>;
};

export class AdminReadError extends Error {
  constructor(
    readonly code:
      "ADMIN_REQUIRED" | "UNSUPPORTED_DATABASE" | "READ_UNAVAILABLE",
  ) {
    super(code);
    this.name = "AdminReadError";
  }
}

/** A request-scoped connection; never changes session-wide pool settings. */
export async function withAdminReadConnection<T>(
  payload: Pick<Payload, "db">,
  user: AdminReadUser,
  work: (connection: AdminReadConnection) => Promise<T>,
): Promise<T> {
  if (
    !user?.active ||
    user.role !== "admin" ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0
  ) {
    throw new AdminReadError("ADMIN_REQUIRED");
  }
  if (payload.db.name !== "postgres" || !payload.db.pool?.connect) {
    throw new AdminReadError("UNSUPPORTED_DATABASE");
  }
  const client = await payload.db.pool.connect();
  let releaseError: Error | undefined;
  try {
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
    return await work(client as AdminReadConnection);
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      releaseError = new Error("Read transaction could not be rolled back");
    }
    client.release(releaseError);
  }
}
