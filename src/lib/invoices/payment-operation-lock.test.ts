import type { Payload } from "payload";
import { describe, expect, it, vi } from "vitest";
import {
  PaymentOperationInProgressError,
  PaymentOperationLockUnavailableError,
  withPaymentInvoiceOperationLock,
} from "./payment-operation-lock";

function postgresPayload() {
  const held = new Set<string>();
  const release = vi.fn();
  const connect = vi.fn(async () => {
    let transactionKey: string | null = null;
    return {
      async query<T extends Record<string, unknown>>(
        text: string,
        values: unknown[],
      ) {
        const key = values.join(":");
        if (text.includes("pg_try_advisory_xact_lock")) {
          const locked = !held.has(key);
          if (locked) {
            held.add(key);
            transactionKey = key;
          }
          return { rows: [{ locked }] as unknown as T[] };
        }
        if (text === "ROLLBACK" && transactionKey) {
          held.delete(transactionKey);
        }
        return { rows: [] as T[] };
      },
      release,
    };
  });
  return {
    connect,
    payload: {
      db: { packageName: "@payloadcms/db-postgres", pool: { connect } },
    } as unknown as Payload,
    release,
  };
}

describe("payment invoice operation lock", () => {
  it("allows only one concurrent operation for an invoice", async () => {
    const state = postgresPayload();
    const results = await Promise.allSettled([
      withPaymentInvoiceOperationLock(state.payload, 42, async () => "sent"),
      withPaymentInvoiceOperationLock(state.payload, 42, async () => "paid"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.any(PaymentOperationInProgressError),
    });
    expect(state.connect).toHaveBeenCalledTimes(2);
    expect(state.release).toHaveBeenCalledTimes(2);
  });

  it("does not serialize unrelated invoices", async () => {
    const state = postgresPayload();
    await expect(
      Promise.all([
        withPaymentInvoiceOperationLock(state.payload, 42, async () => "first"),
        withPaymentInvoiceOperationLock(state.payload, 43, async () => "second"),
      ]),
    ).resolves.toEqual(["first", "second"]);
  });

  it("fails closed in Production when PostgreSQL locking is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      withPaymentInvoiceOperationLock({ db: {} } as Payload, 42, async () =>
        "unsafe",
      ),
    ).rejects.toBeInstanceOf(PaymentOperationLockUnavailableError);
    vi.unstubAllEnvs();
  });
});
