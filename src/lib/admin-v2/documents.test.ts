import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
vi.mock("server-only", () => ({}));
import { loadAdminDocumentRegister } from "./document-register";
import { groupDocumentPage, type AdminDocumentItem } from "./documents";
import {
  documentRegisterFilterFingerprint,
  encodeDocumentRegisterCursor,
} from "./document-register-query";

const admin = { id: 1, active: true, role: "admin" };
function setup(count = 26, opposite = false) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `quote-${100 - index}`,
    lead_id: 1,
    customer: "Kunde",
    reference: `T-${index}`,
    filename: "quote.pdf",
    href: `/api/admin/quotes/${100 - index}/pdf`,
    case_href: "/admin-v2/cases/1",
    type: "quote",
    status: "accepted",
    version: "1",
    created_at: new Date("2026-09-12T00:00:00Z"),
    hash: "abc",
    source_id: String(100 - index),
    type_rank: 1,
    secret: "must not leave server",
  }));
  const query = vi.fn(async (sql: string) => ({
    rows: sql.startsWith("SELECT EXISTS")
      ? [{ present: opposite }]
      : sql.startsWith("SELECT DISTINCT")
        ? [{ status: "accepted" }]
        : sql.startsWith("SELECT id")
          ? rows
          : [],
  }));
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  return {
    payload: {
      db: { name: "postgres", pool: { connect } },
    } as unknown as Payload,
    query,
    connect,
    release,
  };
}

describe("bounded document register adapter", () => {
  it("returns only 25 narrow DTOs and a next boundary, not a fabricated total", async () => {
    const fixture = setup();
    const page = await loadAdminDocumentRegister(fixture.payload, admin);
    expect(page.items).toHaveLength(25);
    expect(page.items[0]).toMatchObject({
      id: "quote-100",
      caseHref: "/admin-v2/cases/1",
      version: 1,
      href: "/api/admin/quotes/100/pdf",
    });
    expect(page.items[0]).not.toHaveProperty("secret");
    expect(page.items[0]).not.toHaveProperty("source_id");
    expect(page).not.toHaveProperty("totalDocs");
    expect(page.nextCursor).toBeTruthy();
    expect(page.previousCursor).toBeUndefined();
    expect(page.statuses).toEqual(["accepted"]);
    expect(fixture.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(fixture.release).toHaveBeenCalledOnce();
  });

  it("trims the lookahead before reversing a previous page", async () => {
    const fixture = setup(26, true);
    const cursor = encodeDocumentRegisterCursor({
      version: 1,
      direction: "backward",
      createdAt: "2026-09-12T00:00:00Z",
      sourceId: 50,
      typeRank: 1,
      filterFingerprint: documentRegisterFilterFingerprint(),
    });
    const page = await loadAdminDocumentRegister(
      fixture.payload,
      admin,
      {},
      cursor,
      "backward",
    );
    expect(page.items[0].id).toBe("quote-76");
    expect(page.items.at(-1)?.id).toBe("quote-100");
    expect(page.previousCursor).toBeTruthy();
    expect(page.nextCursor).toBeTruthy();
  });

  it("denies non-admin access before acquiring a connection", async () => {
    const fixture = setup();
    await expect(
      loadAdminDocumentRegister(fixture.payload, { ...admin, role: "worker" }),
    ).rejects.toMatchObject({ code: "ADMIN_REQUIRED" });
    expect(fixture.connect).not.toHaveBeenCalled();
  });

  it("does not run document SQL for an invalid cursor", async () => {
    const fixture = setup();
    await expect(
      loadAdminDocumentRegister(fixture.payload, admin, {}, "invalid"),
    ).rejects.toThrow();
    expect(
      fixture.query.mock.calls.some(([sql]) => sql.startsWith("SELECT")),
    ).toBe(false);
    expect(fixture.release).toHaveBeenCalledOnce();
  });

  it("preserves order when the same case appears in nonconsecutive groups", () => {
    const items = [
      { id: "a", leadId: 1 },
      { id: "b", leadId: 2 },
      { id: "c", leadId: 1 },
    ] as AdminDocumentItem[];
    const groups = groupDocumentPage(items);
    expect(groups.map((group) => group.key)).toEqual(["a", "b", "c"]);
    expect(groups.flatMap((group) => group.documents)).toEqual(items);
  });
});
