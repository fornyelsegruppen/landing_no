import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildDocumentRegisterQuery,
  buildDocumentStatusFacetQuery,
  documentRegisterFilterFingerprint,
  encodeDocumentRegisterCursor,
  type DocumentRegisterCursor,
} from "./document-register-query";

type DocumentRow = {
  id: string;
  lead_id: number;
  customer: string;
  reference: string;
  filename: string;
  href: string;
  case_href: string;
  type: string;
  status: string;
  version: string | null;
  created_at: string | Date;
  hash: string | null;
  source_id: number;
  type_rank: number;
};
type TestFilters = NonNullable<Parameters<typeof buildDocumentRegisterQuery>[0]>["filters"];

let database: PGlite;

async function rows(input: Parameters<typeof buildDocumentRegisterQuery>[0] = {}) {
  const query = buildDocumentRegisterQuery(input);
  const result = await database.query<DocumentRow>(query.text, query.values);
  return { ...query, rows: result.rows };
}

function cursor(
  row: DocumentRow,
  direction: DocumentRegisterCursor["direction"],
  filters: TestFilters = {},
) {
  return encodeDocumentRegisterCursor({
    version: 1,
    direction,
    createdAt: new Date(row.created_at).toISOString(),
    typeRank: row.type_rank,
    sourceId: row.source_id,
    filterFingerprint: documentRegisterFilterFingerprint(filters),
  });
}

beforeAll(async () => {
  database = new PGlite();
  await database.exec(`
    CREATE TABLE leads (id integer PRIMARY KEY, name text, created_at timestamptz NOT NULL);
    CREATE TABLE quotes (id integer PRIMARY KEY, reference text, lead_id integer NOT NULL, version numeric, snapshot_hash text, status text, created_at timestamptz NOT NULL);
    CREATE TABLE contracts (id integer PRIMARY KEY, reference text, quote_id integer NOT NULL, version numeric, document_hash text, status text, signed_document_id integer, company_signed_document_id integer, created_at timestamptz NOT NULL);
    CREATE TABLE change_agreements (id integer PRIMARY KEY, reference text, work_order_id integer NOT NULL, version numeric, document_hash text, status text, accepted_document_id integer, created_at timestamptz NOT NULL);
    CREATE TABLE work_orders (id integer PRIMARY KEY, reference text, lead_id integer, status text, created_at timestamptz NOT NULL);
    CREATE TABLE roof_measurements (id integer PRIMARY KEY, reference text, lead_id integer NOT NULL, input_hash text, status text, map_image_id integer, created_at timestamptz NOT NULL);
    CREATE TABLE private_media (id integer PRIMARY KEY, filename text, owner_type text, owner_id text, created_at timestamptz NOT NULL);
    CREATE TABLE invoice_records (id integer PRIMARY KEY, reference text, lead_id integer NOT NULL, status text, document_hash text, document_id integer, created_at timestamptz NOT NULL);
    CREATE TABLE official_invoices (id integer PRIMARY KEY, reference text, invoice_number text, lead_id integer NOT NULL, status text, original_hash text, original_document_id integer, created_at timestamptz NOT NULL);
    CREATE TABLE warranties (id integer PRIMARY KEY, reference text, lead_id integer NOT NULL, status text, document_hash text, document_id integer, created_at timestamptz NOT NULL);
    INSERT INTO leads (id, name, created_at)
      SELECT id, 'Customer ' || id::text, '2026-01-01T00:00:00Z'::timestamptz FROM generate_series(1, 501) AS ids(id);
    INSERT INTO leads (id, name, created_at) VALUES (901, 'Åse Žukauskaitė', '2025-01-01T00:00:00Z');
    INSERT INTO quotes (id, reference, lead_id, version, snapshot_hash, status, created_at)
      SELECT id, 'Q-' || id::text, id, 1, 'quote-hash-' || id::text, CASE WHEN id % 2 = 0 THEN 'approved' ELSE 'draft' END, '2026-01-02T00:00:00Z'::timestamptz FROM generate_series(1, 501) AS ids(id);
    INSERT INTO quotes (id, reference, lead_id, version, snapshot_hash, status, created_at) VALUES (901, 'Q-DIACRITICS', 901, 1, 'diacritics-hash', 'approved', '2025-01-01T00:00:00Z');
    INSERT INTO leads (id, name, created_at) VALUES (900, 'Punctuation %_ Customer', '2026-01-01T00:00:00Z');
    INSERT INTO quotes (id, reference, lead_id, version, snapshot_hash, status, created_at) VALUES (900, 'literal-reference', 900, 1, 'literal-hash', 'approved', '2026-01-02T00:00:00Z');
    INSERT INTO private_media (id, filename, created_at) VALUES (700, 'signed-customer.pdf', '2026-01-04T00:00:00Z'), (701, 'signed-final.pdf', '2026-01-04T00:00:00Z');
    INSERT INTO contracts (id, reference, quote_id, version, document_hash, status, signed_document_id, company_signed_document_id, created_at) VALUES (700, 'CONTRACT-700', 900, 1, 'contract-hash', 'signed', 700, 701, '2026-01-04T00:00:00Z');
    INSERT INTO work_orders (id, reference, lead_id, status, created_at) VALUES (800, 'WORK-800', 900, 'documented', '2026-01-05T00:00:00Z');
    INSERT INTO private_media (id, filename, owner_type, owner_id, created_at) VALUES (800, 'work-photo.jpg', 'work-order', '800', '2026-01-05T00:00:00Z'), (801, 'ignored-overflow.jpg', 'work-order', '999999999999999999999999', '2026-01-05T00:00:00Z');
  `);
});

afterAll(async () => {
  await database.close();
});

describe("document register SQL", () => {
  it("keeps the ten logical branches bounded after joining more than 500 source rows", async () => {
    const result = await rows({ filters: { type: "quote" } });

    expect(result.rows).toHaveLength(26);
    expect(result.rows[0]).toMatchObject({ id: "quote-900", type: "quote", source_id: 900 });
    expect(result.rows.at(-1)).toMatchObject({ id: "quote-477", source_id: 477 });
    expect(result.text).not.toContain("UNION ALL");
    expect(result.text).not.toContain("roof_measurements.version");
  });

  it("emits separate customer-signed and final-contract rows from one signed contract", async () => {
    const result = await rows({ filters: { type: "all" }, direction: "forward" });
    const contractRows = result.rows.filter((row) => row.source_id === 700);

    expect(contractRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "customer_signed", href: "/api/admin/media/700", filename: "signed-customer.pdf" }),
      expect.objectContaining({ type: "final_contract", href: "/api/admin/media/701", filename: "signed-final.pdf" }),
    ]));
    expect(contractRows).toHaveLength(2);
  });

  it("joins canonical numeric work owners without casting malformed or overflowing owner IDs", async () => {
    const result = await rows({ filters: { type: "work_documentation" } });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ source_id: 800, href: "/api/admin/media/800" });
  });

  it("keeps more than 125 same-lead invoice records without PDFs reachable", async () => {
    await database.exec(`
      INSERT INTO invoice_records (id, reference, lead_id, status, document_hash, document_id, created_at)
        SELECT id, 'BOUNDARY-NOPDF-INVOICE-' || id::text, 901, 'approved', 'hash-' || id::text, NULL,
          '2026-02-01T00:00:00Z'::timestamptz
        FROM generate_series(1001, 1130) AS ids(id);
    `);

    const filters = { type: "invoice_draft" as const, query: "BOUNDARY-NOPDF" };
    const seen = new Set<string>();
    let page = await rows({ filters });
    expect(page.rows).toHaveLength(26);

    for (let index = 0; index < 5; index += 1) {
      if (index > 0) {
        page = await rows({
          filters,
          cursor: cursor(page.rows.at(-1)!, "forward", filters),
        });
      }
      for (const row of page.rows) {
        seen.add(row.id);
        expect(row.filename).toBe("");
        expect(row.href).toBe(`/admin-v2/cases/901?invoiceRecord=${row.source_id}#invoice-${row.source_id}`);
      }
    }

    expect(seen.size).toBe(130);
  });

  it("finds zero-PDF invoice and warranty records through the normal search", async () => {
    await database.exec(`
      INSERT INTO invoice_records (id, reference, lead_id, status, document_hash, document_id, created_at)
        VALUES (2301, 'ZERO-PDF-INVOICE', 901, 'approved', 'invoice-zero-hash', NULL, '2026-04-01T00:00:00Z');
      INSERT INTO warranties (id, reference, lead_id, status, document_hash, document_id, created_at)
        VALUES (2302, 'ZERO-PDF-WARRANTY', 901, 'active', 'warranty-zero-hash', NULL, '2026-04-01T00:00:00Z');
    `);

    const invoice = await rows({ filters: { type: "invoice_draft", query: "ZERO-PDF" } });
    const warranty = await rows({ filters: { type: "warranty", query: "ZERO-PDF" } });

    expect(invoice.rows).toHaveLength(1);
    expect(invoice.rows[0]).toMatchObject({
      source_id: 2301,
      filename: "",
      hash: null,
      href: "/admin-v2/cases/901?invoiceRecord=2301#invoice-2301",
    });
    expect(warranty.rows).toHaveLength(1);
    expect(warranty.rows[0]).toMatchObject({
      source_id: 2302,
      filename: "",
      hash: null,
      href: "/admin-v2/cases/901?warrantyRecord=2302#warranty-2302",
    });
  });

  it("keeps mixed PDF and no-PDF rows on exact 25-item pages with keyset navigation", async () => {
    await database.exec(`
      INSERT INTO invoice_records (id, reference, lead_id, status, document_hash, document_id, created_at)
        SELECT id, 'MIXED-INVOICE-' || id::text, 901, 'approved', 'mixed-invoice-hash-' || id::text, NULL,
          '2026-05-01T00:00:00Z'::timestamptz
        FROM generate_series(2101, 2125) AS ids(id);
      INSERT INTO private_media (id, filename, created_at)
        VALUES (1726, 'mixed-invoice.pdf', '2026-05-01T00:00:00Z'), (1727, 'mixed-warranty.pdf', '2026-05-01T00:00:00Z');
      INSERT INTO invoice_records (id, reference, lead_id, status, document_hash, document_id, created_at)
        VALUES (2126, 'MIXED-INVOICE-PDF', 901, 'approved', 'mixed-invoice-pdf-hash', 1726, '2026-05-01T00:00:00Z');
      INSERT INTO warranties (id, reference, lead_id, status, document_hash, document_id, created_at)
        VALUES (2201, 'MIXED-WARRANTY-NOPDF', 901, 'active', 'mixed-warranty-zero-hash', NULL, '2026-05-02T00:00:00Z'),
          (2202, 'MIXED-WARRANTY-PDF', 901, 'active', 'mixed-warranty-pdf-hash', 1727, '2026-05-02T00:00:00Z');
    `);

    const filters = { query: "MIXED-" };
    const first = await rows({ filters });
    expect(first.rows).toHaveLength(26);
    expect(first.rows.slice(0, 25)).toHaveLength(25);

    const invoiceWithoutPdf = first.rows.find((row) => row.source_id === 2125);
    const warrantyWithoutPdf = first.rows.find((row) => row.source_id === 2201);
    const invoiceWithPdf = first.rows.find((row) => row.source_id === 2126);
    const warrantyWithPdf = first.rows.find((row) => row.source_id === 2202);
    expect(invoiceWithoutPdf).toMatchObject({
      filename: "",
      href: "/admin-v2/cases/901?invoiceRecord=2125#invoice-2125",
    });
    expect(warrantyWithoutPdf).toMatchObject({
      filename: "",
      href: "/admin-v2/cases/901?warrantyRecord=2201#warranty-2201",
    });
    expect(invoiceWithPdf).toMatchObject({ filename: "mixed-invoice.pdf", href: "/api/admin/media/1726" });
    expect(warrantyWithPdf).toMatchObject({ filename: "mixed-warranty.pdf", href: "/api/admin/media/1727" });

    const second = await rows({
      filters,
      cursor: cursor(first.rows[24], "forward", filters),
    });
    expect(second.rows).toHaveLength(3);
    const previous = await rows({
      filters,
      direction: "backward",
      cursor: cursor(second.rows[0], "backward", filters),
    });
    expect(previous.rows.reverse().map((row) => row.id)).toEqual(first.rows.slice(0, 25).map((row) => row.id));
  });

  it("treats search punctuation literally and returns only the matching relation", async () => {
    const result = await rows({ filters: { type: "quote", query: "%_" } });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ source_id: 900, customer: "Punctuation %_ Customer" });
    expect(result.values).toContain("\\%\\_");
  });

  it("folds Norwegian and Lithuanian diacritics through the database search contract", async () => {
    const result = await rows({ filters: { type: "quote", query: "åse žuk" } });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ source_id: 901, customer: "Åse Žukauskaitė" });
  });

  it("round-trips forward and backward keyset pages without omissions", async () => {
    const filters = { type: "quote" as const, query: "Q-" };
    const first = await rows({ filters });
    const secondCursor = cursor(first.rows.at(-1)!, "forward", filters);
    const second = await rows({ filters, cursor: secondCursor });
    const previousCursor = cursor(second.rows[0], "backward", filters);
    const previous = await rows({ filters, direction: "backward", cursor: previousCursor });

    expect(second.rows[0].source_id).toBe(475);
    expect(previous.rows.reverse().map((row) => row.id)).toEqual(first.rows.map((row) => row.id));
    expect(new Set(first.rows.concat(second.rows).map((row) => row.id)).size).toBe(52);
  });

  it("uses the immediate preceding page for backward navigation from a deeper page", async () => {
    const filters = { type: "quote" as const, query: "Q-" };
    const pages: DocumentRow[][] = [];
    let page = (await rows({ filters })).rows;
    pages.push(page);
    for (let index = 1; index < 4; index += 1) {
      page = (await rows({
        filters,
        cursor: cursor(page.at(-1)!, "forward", filters),
      })).rows;
      pages.push(page);
    }

    const previous = await rows({
      filters,
      direction: "backward",
      cursor: cursor(pages[3][0], "backward", filters),
    });

    expect(previous.rows.reverse().map((row) => row.id)).toEqual(pages[2].map((row) => row.id));
  });

  it("rejects a backward query without a boundary cursor and rejects filter tampering", async () => {
    expect(() => buildDocumentRegisterQuery({ direction: "backward" })).toThrow(/requires a cursor/i);
    const first = await rows({ filters: { type: "quote" } });
    const encoded = cursor(first.rows.at(-1)!, "forward", { type: "quote" });

    expect(() => buildDocumentRegisterQuery({ filters: { type: "warranty" }, cursor: encoded })).toThrow(/does not match/i);
    expect(() => buildDocumentRegisterQuery({ filters: { type: "quote" }, direction: "backward", cursor: encoded })).toThrow(/does not match/i);
  });

  it("builds an independent exact status facet without applying a status filter", async () => {
    const query = buildDocumentStatusFacetQuery({ type: "quote", status: "draft" });
    const result = await database.query<{ status: string }>(query.text, query.values);

    expect(result.rows.map((row) => row.status)).toEqual(["approved", "draft"]);
    expect(query.text).not.toContain("LIMIT 26");
  });
});
