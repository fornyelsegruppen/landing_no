import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ database: null as PGlite | null }));
vi.mock("./admin-read-db", () => ({
  withAdminReadConnection: async (
    _payload: unknown,
    _user: unknown,
    work: (connection: PGlite) => Promise<unknown>,
  ) => {
    if (!state.database) throw new Error("test database is not initialized");
    return work(state.database);
  },
}));

import { loadAdminCaseList, normalizeCaseListFilters } from "./case-list";

describe("admin case list", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    state.database = database;
    await database.exec(`
      CREATE TABLE users (
        id integer PRIMARY KEY,
        email text,
        display_name text,
        role text NOT NULL,
        active boolean NOT NULL
      );
      CREATE TABLE leads (
        id integer PRIMARY KEY,
        name text,
        email text,
        phone text,
        address text,
        house_number text,
        postal text,
        city text,
        inquiry_type text,
        status text,
        record_state text,
        archive_classification text,
        created_at timestamptz,
        next_action_at timestamptz,
        purge_after timestamptz,
        next_action_blocker text,
        assigned_to_id integer
      );
      CREATE TABLE roof_measurements (
        id integer PRIMARY KEY, lead_id integer, status text, created_at timestamptz
      );
      CREATE TABLE price_calculations (
        id integer PRIMARY KEY, lead_id integer, status text, created_at timestamptz
      );
      CREATE TABLE quotes (
        id integer PRIMARY KEY, lead_id integer, reference text, status text,
        version numeric, created_at timestamptz
      );
      CREATE TABLE contracts (
        id integer PRIMARY KEY, quote_id integer, reference text, status text,
        company_signed_at timestamptz, version numeric, created_at timestamptz
      );
      CREATE TABLE messages (
        id integer PRIMARY KEY, lead_id integer, status text, category text,
        direction text, subject text, reply_to_message_id integer,
        ai_analysis jsonb, created_at timestamptz
      );
      CREATE TABLE work_orders (
        id integer PRIMARY KEY, lead_id integer, status text, assigned_worker_id integer,
        documentation_submitted_at timestamptz, reference text, created_at timestamptz
      );
      INSERT INTO users (id, email, display_name, role, active)
      VALUES (31, 'worker31@example.no', 'Worker 31', 'worker', TRUE);
    `);
    for (let id = 1; id <= 26; id += 1) {
      await database.query(
        `INSERT INTO leads
          (id, name, email, address, house_number, postal, city, inquiry_type,
           status, record_state, created_at)
         VALUES ($1, $2, $3, 'Testveien', '1', '0001', 'Oslo', 'takvask',
           'new', 'active', $4::timestamptz)`,
        [
          id,
          `Lead ${id}`,
          `lead${id}@example.no`,
          `2026-09-${String(27 - id).padStart(2, "0")}T08:00:00Z`,
        ],
      );
    }
    await database.query(
      `INSERT INTO work_orders
        (id, lead_id, status, assigned_worker_id, created_at)
       VALUES (2601, 26, 'unassigned', 31, '2026-09-01T08:00:00Z')`,
    );
  });

  afterEach(async () => {
    state.database = null;
    await database.close();
  });

  it("normalizes filters without accepting invalid dates or workers", () => {
    expect(
      normalizeCaseListFilters({
        query: "  Ola   Nordmann ",
        status: "unknown" as never,
        workerId: -1,
        dateFrom: "25.08.2026",
        dateTo: "2026-08-31",
      }),
    ).toEqual({
      action: "all",
      dateFrom: undefined,
      dateTo: "2026-08-31",
      query: "Ola Nordmann",
      recordState: "active",
      status: "all",
      workerId: undefined,
    });
  });

  it.each([
    ["action", { action: "assign_worker" as const }],
    ["worker", { workerId: 31 }],
  ])(
    "filters %s before pagination so the older matching lead remains visible",
    async (_label, filters) => {
      const result = await loadAdminCaseList(
        { db: { name: "postgres" } } as never,
        filters,
        { page: 1, limit: 25 },
        { id: 1, active: true, role: "admin" },
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 26,
        customer: "Lead 26",
        href: "/admin-v2/cases/26",
        nextAction: "assign_worker",
        assignedWorker: "Worker 31",
        workStatus: "unassigned",
      });
      expect(result.totalDocs).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.hasNextPage).toBe(false);
    },
  );

  it("keeps an older active work order ahead of a newer terminal snapshot", async () => {
    await database.query(
      `INSERT INTO leads
        (id, name, email, address, house_number, postal, city, inquiry_type,
         status, record_state, created_at)
       VALUES (27, 'Lead 27', 'lead27@example.no', 'Testveien', '1', '0001',
         'Oslo', 'takvask', 'converted', 'active', '2026-09-02T08:00:00Z')`,
    );
    await database.query(
      `INSERT INTO work_orders
        (id, lead_id, status, assigned_worker_id, created_at)
       VALUES
        (2701, 27, 'assigned', 31, '2026-08-20T08:00:00Z'),
        (2702, 27, 'documented', NULL, '2026-09-02T09:00:00Z')`,
    );

    const result = await loadAdminCaseList(
      { db: { name: "postgres" } } as never,
      { action: "schedule_work", workerId: 31 },
      { page: 1, limit: 25 },
      { id: 1, active: true, role: "admin" },
    );

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 27,
        nextAction: "schedule_work",
        assignedWorker: "Worker 31",
        workStatus: "assigned",
      }),
    ]);
    expect(result.totalDocs).toBe(1);
  });

  it("keeps an effective signed contract when a later quote version is selected", async () => {
    await database.query(
      `INSERT INTO leads
        (id, name, email, address, house_number, postal, city, inquiry_type,
         status, record_state, created_at)
       VALUES (28, 'Lead 28', 'lead28@example.no', 'Testveien', '1', '0001',
         'Oslo', 'takvask', 'converted', 'active', '2026-09-03T08:00:00Z')`,
    );
    await database.query(
      `INSERT INTO quotes (id, lead_id, reference, status, version, created_at)
       VALUES
        (2801, 28, 'Q-28-1', 'accepted', 1, '2026-08-20T08:00:00Z'),
        (2802, 28, 'Q-28-2', 'accepted', 2, '2026-09-03T09:00:00Z')`,
    );
    await database.query(
      `INSERT INTO contracts
        (id, quote_id, reference, status, version, created_at)
       VALUES (2803, 2801, 'K-28-1', 'signed', 1, '2026-08-21T08:00:00Z')`,
    );

    const result = await loadAdminCaseList(
      { db: { name: "postgres" } } as never,
      { action: "company_sign_contract" },
      { page: 1, limit: 25 },
      { id: 1, active: true, role: "admin" },
    );

    expect(result.items).toEqual([
      expect.objectContaining({ id: 28, nextAction: "company_sign_contract" }),
    ]);
    expect(result.totalDocs).toBe(1);
  });
});
