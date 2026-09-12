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
import { deriveCaseNextAction, type CaseActionInput } from "./case-read-model";

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

  const outboundMessage = {
    id: 900,
    status: "sent",
    category: "quote",
    direction: "outbound",
  };
  const actionScenarios = [
    [
      "review_cancellation",
      { nextActionBlocker: "CUSTOMER_CANCELLATION_REQUEST" },
    ],
    ["retry_message", { message: { id: 1, status: "failed" } }],
    [
      "approve_message",
      { message: { id: 1, status: "draft", category: "information_request" } },
    ],
    [
      "send_closure_confirmation",
      { message: { id: 1, status: "draft", closesContract: true } },
    ],
    [
      "none for a closed lead",
      { leadStatus: "closed", message: outboundMessage },
    ],
    [
      "follow_up_decline",
      { quote: { id: 1, status: "declined" }, message: outboundMessage },
    ],
    ["assign_worker", { workOrder: { id: 1, status: "unassigned" } }],
    ["schedule_work", { workOrder: { id: 1, status: "assigned" } }],
    ["resolve_work_block", { workOrder: { id: 1, status: "blocked" } }],
    [
      "review_completion",
      {
        workOrder: {
          id: 1,
          status: "completed",
          documentationSubmittedAt: "2026-09-01",
        },
      },
    ],
    [
      "wait_worker_documentation",
      { workOrder: { id: 1, status: "completed" } },
    ],
    ["wait_scheduled_start", { workOrder: { id: 1, status: "scheduled" } }],
    ["wait_worker_precheck", { workOrder: { id: 1, status: "on_way" } }],
    ["wait_work_completion", { workOrder: { id: 1, status: "in_progress" } }],
    [
      "none for documented work",
      { workOrder: { id: 1, status: "documented" } },
    ],
    [
      "company_sign_contract",
      {
        quote: { id: 1, status: "accepted" },
        contract: { id: 1, status: "signed" },
        message: outboundMessage,
      },
    ],
    [
      "create_work_order",
      {
        quote: { id: 1, status: "accepted" },
        contract: { id: 1, status: "signed", companySignedAt: "2026-09-01" },
        message: outboundMessage,
      },
    ],
    [
      "prepare_question_reply",
      {
        message: {
          id: 1,
          status: "sent",
          category: "customer_question",
          direction: "inbound",
        },
      },
    ],
    ["generate_reply", {}],
    [
      "prepare_package for null AI status",
      { message: { id: 1, category: "ai_reply", direction: "outbound" } },
    ],
    [
      "prepare_package for non-AI cancelled message",
      {
        message: {
          id: 1,
          status: "cancelled",
          category: "quote",
          direction: "outbound",
        },
      },
    ],
    ["prepare_package", { message: outboundMessage }],
    [
      "approve_package",
      {
        message: outboundMessage,
        canPreparePackage: true,
        measurement: { id: 1, status: "draft" },
        price: { id: 1, status: "ready" },
        quote: { id: 1, status: "draft" },
        contract: { id: 1, status: "draft" },
      },
    ],
    [
      "approve_measurement",
      { message: outboundMessage, measurement: { id: 1, status: "draft" } },
    ],
    [
      "measurement_required",
      { message: outboundMessage, measurement: { id: 1, status: "blocked" } },
    ],
    [
      "calculate_price",
      { message: outboundMessage, measurement: { id: 1, status: "approved" } },
    ],
    [
      "create_quote",
      {
        message: outboundMessage,
        measurement: { id: 1, status: "approved" },
        price: { id: 1, status: "ready" },
      },
    ],
    [
      "approve_quote",
      {
        message: outboundMessage,
        measurement: { id: 1, status: "approved" },
        price: { id: 1, status: "ready" },
        quote: { id: 1, status: "draft" },
      },
    ],
    [
      "issue_quote",
      {
        message: outboundMessage,
        measurement: { id: 1, status: "approved" },
        price: { id: 1, status: "ready" },
        quote: { id: 1, status: "approved" },
      },
    ],
    [
      "wait_customer",
      {
        message: outboundMessage,
        measurement: { id: 1, status: "approved" },
        price: { id: 1, status: "ready" },
        quote: { id: 1, status: "sent" },
      },
    ],
  ] as Array<[string, CaseActionInput]>;

  it("matches SQL-derived actions against canonical derivation scenarios", async () => {
    for (const [index, [label, input]] of actionScenarios.entries()) {
      const id = 1000 + index;
      const name = `Parity ${index}`;
      const message = input.message;
      const measurement = input.measurement;
      const price = input.price;
      const quote = input.quote;
      const contract = input.contract;
      const workOrder = input.workOrder;
      await database.query(
        `INSERT INTO leads
          (id, name, email, address, inquiry_type, status, record_state,
           next_action_blocker, created_at)
         VALUES ($1, $2, $3, 'Testveien', 'takvask', $4, 'active', $5, $6::timestamptz)`,
        [
          id,
          name,
          `parity${index}@example.no`,
          input.leadStatus || "new",
          input.nextActionBlocker || null,
          `2026-08-${String(index + 1).padStart(2, "0")}T08:00:00Z`,
        ],
      );
      if (message) {
        const analysis = message.closesContract
          ? JSON.stringify({ customerContractRequestId: 1, decision: "close" })
          : null;
        await database.query(
          `INSERT INTO messages
            (id, lead_id, status, category, direction, subject, ai_analysis, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz)`,
          [
            5000 + index,
            id,
            message.status || null,
            message.category || null,
            message.direction || null,
            `Parity message ${index}`,
            analysis,
            `2026-08-${String(index + 1).padStart(2, "0")}T09:00:00Z`,
          ],
        );
      }
      if (measurement) {
        await database.query(
          `INSERT INTO roof_measurements (id, lead_id, status, created_at)
           VALUES ($1, $2, $3, $4::timestamptz)`,
          [
            6000 + index,
            id,
            measurement.status || null,
            `2026-08-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
          ],
        );
      }
      if (price) {
        await database.query(
          `INSERT INTO price_calculations (id, lead_id, status, created_at)
           VALUES ($1, $2, $3, $4::timestamptz)`,
          [
            7000 + index,
            id,
            price.status || null,
            `2026-08-${String(index + 1).padStart(2, "0")}T11:00:00Z`,
          ],
        );
      }
      if (quote) {
        await database.query(
          `INSERT INTO quotes (id, lead_id, reference, status, version, created_at)
           VALUES ($1, $2, $3, $4, 1, $5::timestamptz)`,
          [
            8000 + index,
            id,
            `Parity quote ${index}`,
            quote.status || null,
            `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
          ],
        );
      }
      if (contract) {
        await database.query(
          `INSERT INTO contracts
            (id, quote_id, reference, status, company_signed_at, version, created_at)
           VALUES ($1, $2, $3, $4, $5::timestamptz, 1, $6::timestamptz)`,
          [
            9000 + index,
            quote ? 8000 + index : null,
            `Parity contract ${index}`,
            contract.status || null,
            contract.companySignedAt || null,
            `2026-08-${String(index + 1).padStart(2, "0")}T13:00:00Z`,
          ],
        );
      }
      if (workOrder) {
        await database.query(
          `INSERT INTO work_orders
            (id, lead_id, status, assigned_worker_id, documentation_submitted_at, created_at)
           VALUES ($1, $2, $3, NULL, $4::timestamptz, $5::timestamptz)`,
          [
            10000 + index,
            id,
            workOrder.status || null,
            workOrder.documentationSubmittedAt || null,
            `2026-08-${String(index + 1).padStart(2, "0")}T14:00:00Z`,
          ],
        );
      }
      const result = await loadAdminCaseList(
        { db: { name: "postgres" } } as never,
        { query: name },
        { page: 1, limit: 25 },
        { id: 1, active: true, role: "admin" },
      );
      expect(result.totalDocs, label).toBe(1);
      expect(result.items[0]?.nextAction, label).toBe(
        deriveCaseNextAction(input).kind,
      );
    }
  }, 120_000);

  it("matches SQL canPreparePackage parity for missing and placeholder addresses", async () => {
    const addresses = [
      undefined,
      null,
      "",
      "Ikke oppgitt",
      "Testveien",
    ] as const;
    for (const [index, address] of addresses.entries()) {
      const id = 2000 + index;
      const canPreparePackage =
        Boolean(address) && !/^ikke oppgitt$/i.test(address || "");
      await database.query(
        `INSERT INTO leads
          (id, name, email, address, inquiry_type, status, record_state, created_at)
         VALUES ($1, $2, $3, $4, 'takvask', 'new', 'active', $5::timestamptz)`,
        [
          id,
          `Address parity ${index}`,
          `address${index}@example.no`,
          address || null,
          `2026-08-${String(index + 20).padStart(2, "0")}T08:00:00Z`,
        ],
      );
      await database.query(
        `INSERT INTO messages
          (id, lead_id, status, category, direction, subject, created_at)
         VALUES ($1, $2, 'draft', 'ai_reply', 'outbound', $3, $4::timestamptz)`,
        [
          11000 + index,
          id,
          `Address message ${index}`,
          `2026-08-${String(index + 20).padStart(2, "0")}T09:00:00Z`,
        ],
      );
      const input: CaseActionInput = {
        canPreparePackage,
        message: { id: 11000 + index, status: "draft", category: "ai_reply" },
      };
      const result = await loadAdminCaseList(
        { db: { name: "postgres" } } as never,
        { query: `Address parity ${index}` },
        { page: 1, limit: 25 },
        { id: 1, active: true, role: "admin" },
      );
      expect(result.items[0]?.nextAction).toBe(
        deriveCaseNextAction(input).kind,
      );
    }
  }, 60_000);

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

  it("uses the newest non-cancelled work snapshot, including documented state", async () => {
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
      { action: "none" },
      { page: 1, limit: 25 },
      { id: 1, active: true, role: "admin" },
    );

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 27,
        nextAction: "none",
        workStatus: "documented",
      }),
    ]);
    expect(result.totalDocs).toBe(1);
  });

  it("follows the selected working draft while retaining an older effective contract context", async () => {
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
        (2802, 28, 'Q-28-2', 'draft', 2, '2026-09-03T09:00:00Z')`,
    );
    await database.query(
      `INSERT INTO contracts
        (id, quote_id, reference, status, version, created_at)
       VALUES (2803, 2801, 'K-28-1', 'signed', 1, '2026-08-21T08:00:00Z')`,
    );

    const result = await loadAdminCaseList(
      { db: { name: "postgres" } } as never,
      { action: "generate_reply", query: "Lead 28" },
      { page: 1, limit: 25 },
      { id: 1, active: true, role: "admin" },
    );

    expect(result.items).toEqual([
      expect.objectContaining({ id: 28, nextAction: "generate_reply" }),
    ]);
    expect(result.totalDocs).toBe(1);
  });

  it.each(["archived", "trashed"] as const)(
    "keeps %s record-state filtering in the SQL predicate",
    async (recordState) => {
      await database.query(
        `INSERT INTO leads
          (id, name, email, address, inquiry_type, status, record_state, created_at)
         VALUES ($1, $2, $3, 'Testveien', 'takvask', 'closed', $4, '2026-09-04T08:00:00Z')`,
        [
          recordState === "archived" ? 29 : 30,
          `Lead ${recordState}`,
          `${recordState}@example.no`,
          recordState,
        ],
      );
      const result = await loadAdminCaseList(
        { db: { name: "postgres" } } as never,
        { recordState },
        { page: 1, limit: 25 },
        { id: 1, active: true, role: "admin" },
      );
      expect(result.totalDocs).toBe(1);
      expect(result.items[0]).toMatchObject({
        customer: `Lead ${recordState}`,
      });
    },
  );
});
