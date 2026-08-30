import type { Payload } from "payload";

type PoolClient = {
  query<T extends Record<string, unknown>>(
    text: string,
    values: unknown[],
  ): Promise<{ rows: T[] }>;
  release(destroy?: boolean): void;
};

type PostgresPool = {
  connect(): Promise<PoolClient>;
};

const paymentLockNamespace = 1_414_219_812;
const localDevelopmentLocks = new Set<number>();

export class PaymentOperationInProgressError extends Error {
  constructor() {
    super("Another payment operation is already in progress for this invoice");
    this.name = "PaymentOperationInProgressError";
  }
}

export class PaymentOperationLockUnavailableError extends Error {
  constructor() {
    super("The payment operation lock is temporarily unavailable");
    this.name = "PaymentOperationLockUnavailableError";
  }
}

function postgresPool(payload: Payload) {
  const database = payload.db as unknown as
    | {
        packageName?: string;
        pool?: PostgresPool;
      }
    | undefined;
  if (
    !database ||
    database.packageName !== "@payloadcms/db-postgres" ||
    !database.pool?.connect
  ) {
    return null;
  }
  return database.pool;
}

async function withLocalDevelopmentLock<T>(
  invoiceId: number,
  operation: () => Promise<T>,
) {
  if (localDevelopmentLocks.has(invoiceId)) {
    throw new PaymentOperationInProgressError();
  }
  localDevelopmentLocks.add(invoiceId);
  try {
    return await operation();
  } finally {
    localDevelopmentLocks.delete(invoiceId);
  }
}

export async function withPaymentInvoiceOperationLock<T>(
  payload: Payload,
  invoiceId: number,
  operation: () => Promise<T>,
) {
  if (
    !Number.isSafeInteger(invoiceId) ||
    invoiceId < 1 ||
    invoiceId > 2_147_483_647
  ) {
    throw new TypeError("Payment operation has no valid invoice reference");
  }

  const pool = postgresPool(payload);
  if (!pool) {
    if (process.env.NODE_ENV !== "production") {
      return withLocalDevelopmentLock(invoiceId, operation);
    }
    throw new PaymentOperationLockUnavailableError();
  }

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch {
    throw new PaymentOperationLockUnavailableError();
  }

  let transactionStarted = false;
  let lockAcquired = false;
  let destroyConnection = false;
  try {
    await client.query("BEGIN", []);
    transactionStarted = true;
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock($1::integer, $2::integer) AS locked",
      [paymentLockNamespace, invoiceId],
    );
    if (result.rows[0]?.locked !== true) {
      throw new PaymentOperationInProgressError();
    }
    lockAcquired = true;
    return await operation();
  } catch (error) {
    if (error instanceof PaymentOperationInProgressError || lockAcquired) {
      throw error;
    }
    destroyConnection = true;
    throw new PaymentOperationLockUnavailableError();
  } finally {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK", []);
      } catch {
        destroyConnection = true;
      }
    }
    client.release(destroyConnection);
  }
}
