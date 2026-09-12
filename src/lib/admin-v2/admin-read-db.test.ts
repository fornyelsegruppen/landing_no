import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
vi.mock("server-only", () => ({}));
import { withAdminReadConnection } from "./admin-read-db";

const admin = { id: 1, active: true, role: "admin" };

describe("admin read connection", () => {
  it.each([null, { ...admin, active: false }, { ...admin, role: "worker" }])(
    "denies an unauthorized principal before acquiring a connection",
    async (user) => {
      const connect = vi.fn();
      const payload = {
        db: { name: "postgres", pool: { connect } },
      } as unknown as Payload;
      await expect(
        withAdminReadConnection(payload, user, vi.fn()),
      ).rejects.toMatchObject({ code: "ADMIN_REQUIRED" });
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it("rejects unsupported adapters without invoking a capped fallback", async () => {
    const work = vi.fn();
    await expect(
      withAdminReadConnection(
        { db: { name: "sqlite" } } as unknown as Payload,
        admin,
        work,
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_DATABASE" });
    expect(work).not.toHaveBeenCalled();
  });

  it("rolls back on reader failure and releases the transaction connection", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    const payload = {
      db: {
        name: "postgres",
        pool: { connect: async () => ({ query, release }) },
      },
    } as unknown as Payload;
    await expect(
      withAdminReadConnection(payload, admin, async () => {
        throw new Error("synthetic timeout");
      }),
    ).rejects.toThrow("synthetic timeout");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("READ ONLY"));
    expect(query).toHaveBeenCalledWith("SET LOCAL statement_timeout = '5s'");
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });

  it("discards a connection whose rollback failed", async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("connection lost");
      return { rows: [] };
    });
    const release = vi.fn();
    const payload = {
      db: {
        name: "postgres",
        pool: { connect: async () => ({ query, release }) },
      },
    } as unknown as Payload;
    await withAdminReadConnection(payload, admin, async () => 1);
    expect(release).toHaveBeenCalledWith(expect.any(Error));
  });
});
