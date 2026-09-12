import { PGlite } from "@electric-sql/pglite";
import type { Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadCaseSelectedRecords } from "./case-selected-records";

const admin = { id: 1, role: "admin", active: true };
let database: PGlite;
const queries: string[] = [];
const connect = vi.fn(async () => ({
  query: (text: string, values?: unknown[]) => {
    queries.push(text);
    return database.query(text, values);
  },
  release: vi.fn(),
}));
const payload = {
  db: { name: "postgres", pool: { connect } },
} as unknown as Pick<Payload, "db">;

beforeAll(async () => {
  database = new PGlite();
  await database.exec(`
    CREATE TABLE private_media (id integer PRIMARY KEY);
    CREATE TABLE work_orders (id integer PRIMARY KEY, lead_id integer, reference text);
    CREATE TABLE invoice_records (id integer PRIMARY KEY, lead_id integer, work_order_id integer, reference text, status text, document_hash text, created_at timestamptz, document_id integer, subtotal_ex_vat_ore numeric, vat_ore numeric, total_inc_vat_ore numeric, issued_at timestamptz, due_at timestamptz, external_reference text, admin_note text);
    CREATE TABLE warranties (id integer PRIMARY KEY, lead_id integer, work_order_id integer, reference text, status text, document_hash text, created_at timestamptz, document_id integer, scope text, starts_at timestamptz, ends_at timestamptz, terms_version text);
    INSERT INTO work_orders VALUES (1,1,'OWN-WORK'),(2,2,'FOREIGN-WORK');
    INSERT INTO private_media VALUES (500);
    INSERT INTO invoice_records (id,lead_id,work_order_id,reference,status,document_hash,created_at,subtotal_ex_vat_ore,vat_ore,total_inc_vat_ore,admin_note)
      SELECT n,1,1,'INV-'||n,'draft','invoice-hash-'||n,'2025-01-01'::timestamptz+n*interval '1 day', n*100,n*25,n*125,'note-'||n FROM generate_series(1,126)n;
    INSERT INTO warranties (id,lead_id,work_order_id,reference,status,document_hash,created_at,scope,terms_version)
      SELECT n,1,1,'WAR-'||n,'active','warranty-hash-'||n,'2025-01-01'::timestamptz+n*interval '1 day','scope-'||n,'terms-'||n FROM generate_series(1,126)n;
    UPDATE invoice_records SET document_id=500 WHERE id=126;
    INSERT INTO invoice_records (id,lead_id,work_order_id,reference,status) VALUES (201,2,2,'FOREIGN-INVOICE','draft'),(202,1,2,'OWN-RECORD-BAD-WORK','draft');
    INSERT INTO warranties (id,lead_id,work_order_id,reference,status) VALUES (201,2,2,'FOREIGN-WARRANTY','active');
  `);
});
afterAll(async () => {
  await database.close();
});

describe("exact case-owned historical record read", () => {
  it("returns the selected noPDF invoice/warranty older than 100 newer rows, not latest", async () => {
    const result = await loadCaseSelectedRecords(payload, admin, 1, {
      invoiceRecord: "1",
      warrantyRecord: "1",
    });
    expect(result.unavailable).toBe(false);
    expect(result.records).toEqual([
      expect.objectContaining({
        kind: "invoice",
        id: 1,
        reference: "INV-1",
        totalIncVatOre: 125,
        adminNote: "note-1",
        documentId: undefined,
        workReference: "OWN-WORK",
      }),
      expect.objectContaining({
        kind: "warranty",
        id: 1,
        reference: "WAR-1",
        scope: "scope-1",
        termsVersion: "terms-1",
        documentId: undefined,
      }),
    ]);
    expect(result.records.every((record) => record.id !== 126)).toBe(true);
    expect(
      queries
        .filter(
          (sql) =>
            sql.includes("FROM invoice_records") ||
            sql.includes("FROM warranties"),
        )
        .every((sql) =>
          sql.includes(
            "r.lead_id = $1::integer AND r.id = $2::integer LIMIT 1",
          ),
        ),
    ).toBe(true);
    expect(queries.at(-1)).toBe("ROLLBACK");
  });

  it("rejects IDs owned by a different case and nonexistent IDs without latest fallback", async () => {
    const result = await loadCaseSelectedRecords(payload, admin, 1, {
      invoiceRecord: "201",
      warrantyRecord: "201",
    });
    expect(result).toEqual({ records: [], unavailable: true });
    expect(
      await loadCaseSelectedRecords(payload, admin, 1, {
        invoiceRecord: "999",
      }),
    ).toEqual({ records: [], unavailable: true });
  });

  it("keeps existing PDF references and never exposes a foreign work-order reference", async () => {
    expect(
      (
        await loadCaseSelectedRecords(payload, admin, 1, {
          invoiceRecord: "126",
        })
      ).records[0],
    ).toMatchObject({ id: 126, documentId: 500 });
    expect(
      (
        await loadCaseSelectedRecords(payload, admin, 1, {
          invoiceRecord: "202",
        })
      ).records[0].workReference,
    ).toBeUndefined();
  });

  it.each(["0", "-1", "01", "1.5", "2147483648", "1 OR 1=1", ["1", "2"]])(
    "rejects invalid selection %j before a record SELECT",
    async (value) => {
      const before = queries.length;
      expect(
        await loadCaseSelectedRecords(payload, admin, 1, {
          invoiceRecord: value,
        }),
      ).toEqual({ records: [], unavailable: true });
      expect(
        queries
          .slice(before)
          .some((sql) => sql.includes("FROM invoice_records")),
      ).toBe(false);
    },
  );

  it("requires an active admin before connecting", async () => {
    const before = connect.mock.calls.length;
    await expect(
      loadCaseSelectedRecords(payload, null, 1, { invoiceRecord: "1" }),
    ).rejects.toThrow("ADMIN_REQUIRED");
    await expect(
      loadCaseSelectedRecords(payload, { ...admin, role: "worker" }, 1, {
        invoiceRecord: "1",
      }),
    ).rejects.toThrow("ADMIN_REQUIRED");
    expect(connect.mock.calls.length).toBe(before);
  });

  it("rejects unsupported adapters without connecting or issuing SQL", async () => {
    const before = connect.mock.calls.length;
    const sqlBefore = queries.length;
    const unsupported = {
      db: { name: "sqlite", pool: { connect } },
    } as unknown as Pick<Payload, "db">;
    await expect(
      loadCaseSelectedRecords(unsupported, admin, 1, { invoiceRecord: "1" }),
    ).rejects.toThrow("UNSUPPORTED_DATABASE");
    expect(connect.mock.calls.length).toBe(before);
    expect(queries.length).toBe(sqlBefore);
  });
});
