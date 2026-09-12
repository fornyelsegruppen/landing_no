import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";

vi.mock("server-only", () => ({}));

import { loadCaseCurrentSelection } from "./case-current-selection";

const admin = { id: 1, active: true, role: "admin" };
let database: PGlite;

function payloadForDatabase() {
  const client = {
    query: (text: string, values?: unknown[]) => database.query(text, values),
    release: vi.fn(),
  };
  return {
    db: {
      name: "postgres",
      pool: { connect: async () => client },
    },
  } as unknown as Pick<Payload, "db">;
}

beforeAll(async () => {
  database = new PGlite();
  await database.exec(`
    CREATE TABLE leads (id integer PRIMARY KEY, status text);
    CREATE TABLE roof_measurements (id integer PRIMARY KEY, lead_id integer, status text, created_at timestamptz NOT NULL);
    CREATE TABLE price_calculations (id integer PRIMARY KEY, lead_id integer, status text, created_at timestamptz NOT NULL);
    CREATE TABLE quotes (id integer PRIMARY KEY, lead_id integer, version numeric, status text, created_at timestamptz NOT NULL);
    CREATE TABLE contracts (id integer PRIMARY KEY, quote_id integer, version numeric, status text, signed_at timestamptz, company_signed_at timestamptz, created_at timestamptz NOT NULL);
    CREATE TABLE work_orders (id integer PRIMARY KEY, lead_id integer, status text, created_at timestamptz NOT NULL);
    CREATE TABLE messages (id integer PRIMARY KEY, lead_id integer, status text, category text, subject text, reply_to_message_id integer, created_at timestamptz NOT NULL);
    INSERT INTO leads (id, status) VALUES
      (1, 'quoted'), (2, 'quoted'), (3, 'new'), (4, 'new'), (5, 'quoted'),
      (6, 'quoted');

    INSERT INTO quotes (id, lead_id, version, status, created_at) VALUES (1, 1, 1, 'approved', '2026-01-01T00:00:00Z');
    INSERT INTO quotes (id, lead_id, version, status, created_at)
      SELECT id, 1, id, 'superseded', '2026-01-02T00:00:00Z' FROM generate_series(2, 127) AS ids(id);
    INSERT INTO quotes (id, lead_id, version, status, created_at) VALUES
      (201, 2, 5, 'declined', '2026-01-03T00:00:00Z'),
      (202, 2, 5, 'accepted', '2026-01-03T00:00:00Z');

    INSERT INTO contracts (id, quote_id, version, status, signed_at, company_signed_at, created_at) VALUES
      (1, 1, 1, 'signed', '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z'),
      (200, 1, 200, 'draft', NULL, NULL, '2026-01-04T00:00:00Z'),
      (201, 202, 5, 'signed', '2026-01-05T00:00:00Z', '2026-01-05T00:00:00Z', '2026-01-05T00:00:00Z'),
      (202, 202, 5, 'draft', NULL, NULL, '2026-01-05T00:00:00Z');

    INSERT INTO roof_measurements (id, lead_id, status, created_at) VALUES
      (1, 1, 'superseded', '2026-01-10T00:00:00Z'),
      (2, 1, 'approved', '2026-01-09T00:00:00Z'),
      (3, 1, 'approved', '2026-01-08T00:00:00Z'),
      (4, 2, 'approved', '2026-01-11T00:00:00Z'),
      (5, 2, 'approved', '2026-01-11T00:00:00Z');
    INSERT INTO price_calculations (id, lead_id, status, created_at) VALUES
      (1, 1, 'superseded', '2026-01-10T00:00:00Z'),
      (2, 1, 'ready', '2026-01-09T00:00:00Z');
    INSERT INTO work_orders (id, lead_id, status, created_at) VALUES
      (1, 1, 'cancelled', '2026-01-10T00:00:00Z'),
      (2, 1, 'completed', '2026-01-09T00:00:00Z');

    INSERT INTO contracts (id, quote_id, version, status, signed_at, company_signed_at, created_at)
      VALUES (300, 1, 99, 'draft', NULL, NULL, '2026-01-12T00:00:00Z');
    INSERT INTO roof_measurements (id, lead_id, status, created_at)
      VALUES (301, 3, NULL, '2026-01-01T00:00:00Z');
    INSERT INTO price_calculations (id, lead_id, status, created_at)
      VALUES (302, 3, NULL, '2026-01-01T00:00:00Z');
    INSERT INTO work_orders (id, lead_id, status, created_at)
      VALUES (303, 3, NULL, '2026-01-01T00:00:00Z');
    INSERT INTO messages (id, lead_id, status, category, subject, reply_to_message_id, created_at)
      VALUES (401, 4, NULL, NULL, 'Nullable status', NULL, '2026-01-01T00:00:00Z'),
             (402, 4, 'delivered', NULL, 'Nullable category', NULL, '2026-01-02T00:00:00Z');
    INSERT INTO quotes (id, lead_id, version, status, created_at)
      VALUES (501, 5, NULL, NULL, '2026-01-01T00:00:00Z');
    INSERT INTO quotes (id, lead_id, version, status, created_at)
      VALUES (601, 6, 1, 'draft', '2026-01-01T00:00:00Z'),
             (602, 6, 2, 'accepted', '2026-01-02T00:00:00Z');
    INSERT INTO contracts (id, quote_id, version, status, signed_at, company_signed_at, created_at)
      VALUES (601, 601, 1, 'draft', NULL, NULL, '2026-01-01T00:00:00Z');
    INSERT INTO messages (id, lead_id, status, category, subject, reply_to_message_id, created_at)
      VALUES (502, 5, 'draft', 'ai_reply', 'Intake draft', NULL, '2026-01-03T00:00:00Z'),
             (503, 5, 'delivered', 'customer_question', 'Older visible', NULL, '2026-01-02T00:00:00Z');

    INSERT INTO messages (id, lead_id, status, category, subject, reply_to_message_id, created_at)
      SELECT id, 1, 'delivered', 'information_request', 'Older failure', NULL, '2026-01-06T00:00:00Z' FROM generate_series(1, 101) AS ids(id);
    UPDATE messages SET status = 'failed', subject = 'Same subject', category = 'customer_question', created_at = '2026-01-01T00:00:00Z' WHERE id = 1;
    INSERT INTO messages (id, lead_id, status, category, subject, reply_to_message_id, created_at) VALUES
      (102, 1, 'delivered', 'customer_question', 'Same subject', NULL, '2026-01-07T00:00:00Z'),
      (103, 1, 'draft', 'ai_reply', 'Obsolete intake draft', NULL, '2026-01-08T00:00:00Z'),
      (104, 1, 'cancelled', 'ai_reply', 'Cancelled AI reply', NULL, '2026-01-09T00:00:00Z');
  `);
});

afterAll(async () => {
  await database.close();
});

describe("loadCaseCurrentSelection", () => {
  it("selects current IDs beyond capped source pages and preserves effective signed history", async () => {
    const result = await loadCaseCurrentSelection(
      payloadForDatabase(),
      admin,
      1,
    );

    expect(result).toEqual({
      measurementId: 2,
      priceId: 2,
      workingQuoteId: 1,
      workingContractId: 200,
      actionContractId: 200,
      effectiveContractId: 1,
      effectiveQuoteId: 1,
      workOrderId: 2,
      messageId: 102,
    });
  });

  it("uses quote status priority and ID tie-breakers for equal versions", async () => {
    const result = await loadCaseCurrentSelection(
      payloadForDatabase(),
      admin,
      2,
    );

    expect(result.workingQuoteId).toBe(202);
    expect(result.workingContractId).toBe(202);
    expect(result.actionContractId).toBe(202);
    expect(result.effectiveContractId).toBe(201);
    expect(result.effectiveQuoteId).toBe(202);
    expect(result.measurementId).toBe(5);
  });

  it("keeps contracts scoped to the case and treats NULL statuses as active", async () => {
    const noQuote = await loadCaseCurrentSelection(
      payloadForDatabase(),
      admin,
      3,
    );
    expect(noQuote.workingQuoteId).toBeNull();
    expect(noQuote.workingContractId).toBeNull();
    expect(noQuote.actionContractId).toBeNull();
    expect(noQuote.measurementId).toBe(301);
    expect(noQuote.priceId).toBe(302);
    expect(noQuote.workOrderId).toBe(303);

    const nullableMessages = await loadCaseCurrentSelection(
      payloadForDatabase(),
      admin,
      4,
    );
    expect(nullableMessages.messageId).toBe(402);
  });

  it("keeps a nullable-version nullable-status quote as the working quote", async () => {
    const result = await loadCaseCurrentSelection(
      payloadForDatabase(),
      admin,
      5,
    );
    expect(result.workingQuoteId).toBe(501);
    expect(result.messageId).toBe(503);
  });

  it("keeps the strict working contract separate from the action fallback", async () => {
    const result = await loadCaseCurrentSelection(
      payloadForDatabase(),
      admin,
      6,
    );
    expect(result.workingQuoteId).toBe(602);
    expect(result.workingContractId).toBeNull();
    expect(result.actionContractId).toBe(601);
  });

  it("denies an invalid lead before acquiring the read connection", async () => {
    await expect(
      loadCaseCurrentSelection(payloadForDatabase(), admin, 0),
    ).rejects.toThrow(/invalid case lead/i);
  });
});
