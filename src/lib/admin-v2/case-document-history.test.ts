import { PGlite } from "@electric-sql/pglite";
import type { Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadCaseDocumentHistory } from "./case-document-history";

const admin = { id: 1, active: true, role: "admin" };

describe("case document ownership against PostgreSQL", () => {
  let database: PGlite;
  let payload: Payload;

  beforeAll(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE roof_measurements(id integer PRIMARY KEY, lead_id integer);
      CREATE TABLE quotes(id integer PRIMARY KEY, lead_id integer);
      CREATE TABLE contracts(id integer PRIMARY KEY, quote_id integer);
      CREATE TABLE work_orders(id integer PRIMARY KEY, lead_id integer);
      CREATE TABLE change_agreements(id integer PRIMARY KEY, work_order_id integer);
      CREATE TABLE invoice_records(id integer PRIMARY KEY, lead_id integer);
      CREATE TABLE warranties(id integer PRIMARY KEY, lead_id integer);
      CREATE TABLE private_media(id integer PRIMARY KEY, filename text, classification text,
        mime_type text DEFAULT 'application/pdf', owner_type text, owner_id text,
        created_at timestamptz NOT NULL DEFAULT '2026-09-12T00:00:00Z');

      INSERT INTO invoice_records VALUES (31,1), (32,1), (33,2);
      INSERT INTO private_media(id,filename,owner_type,owner_id) VALUES
        (31,'invoice-old.pdf','invoice-record','31'),
        (32,'invoice-new.pdf','invoice-record','32'),
        (33,'other-case.pdf','invoice-record','33'),
        (34,'wrong-owner-type.pdf','contract','31');

      INSERT INTO quotes SELECT n,3 FROM generate_series(1001,1126) n;
      INSERT INTO contracts SELECT n,n FROM generate_series(1001,1126) n;
      INSERT INTO roof_measurements SELECT n,3 FROM generate_series(1001,1126) n;
      INSERT INTO work_orders SELECT n,3 FROM generate_series(1001,1126) n;
      INSERT INTO invoice_records SELECT n,3 FROM generate_series(1001,1126) n;
      INSERT INTO warranties SELECT n,3 FROM generate_series(1001,1126) n;
      INSERT INTO change_agreements SELECT n,n FROM generate_series(1001,1126) n;
      INSERT INTO private_media(id,filename,owner_type,owner_id,created_at)
      SELECT 10000 + t.rank * 1000 + n, t.kind || '-' || n || '.pdf', t.kind, n::text,
        '2026-09-12T00:00:00Z'::timestamptz + n * interval '1 second'
      FROM generate_series(1001,1126) n CROSS JOIN (VALUES
        (1,'quote'),(2,'contract'),(3,'roof-measurement'),(4,'work-order'),
        (5,'invoice-record'),(6,'warranty'),(7,'change-agreement'),
        (8,'completion-certificate')) t(rank,kind);
    `);
    payload = {
      db: {
        name: "postgres",
        pool: {
          connect: async () => ({
            query: (text: string, values?: unknown[]) =>
              database.query(text, values),
            release: () => {},
          }),
        },
      },
    } as unknown as Payload;
  }, 30_000);

  afterAll(async () => database?.close());

  it("keeps both invoice owners 31 and 32, even when 32 is current", async () => {
    const history = await loadCaseDocumentHistory(payload, admin, 1, 1);
    expect(history.totalDocs).toBe(2);
    expect(history.items.map((row) => row.id)).toEqual([32, 31]);
    expect(history.items.map((row) => row.href)).toEqual([
      "/api/admin/media/32",
      "/api/admin/media/31",
    ]);
  });

  it("reaches all 126 owners of every supported historical entity without a DTO cap", async () => {
    const first = await loadCaseDocumentHistory(payload, admin, 3, 1);
    expect(first.totalDocs).toBe(126 * 8);
    expect(first.items).toHaveLength(25);
    const seen = new Set<number>();
    // Fixed fixture page bound, never an application find-all implementation.
    for (let page = 1; page <= 41; page += 1) {
      const result = await loadCaseDocumentHistory(payload, admin, 3, page);
      expect(result.items.length).toBeLessThanOrEqual(25);
      result.items.forEach((row) => {
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      });
    }
    expect(seen.size).toBe(1008);
    for (let rank = 1; rank <= 8; rank += 1) {
      expect(seen.has(10000 + rank * 1000 + 1001)).toBe(true);
    }
  }, 30_000);

  it("clamps a removed/out-of-range page to reachable records", async () => {
    const history = await loadCaseDocumentHistory(payload, admin, 1, 999);
    expect(history.page).toBe(1);
    expect(history.items).toHaveLength(2);
  });
});
