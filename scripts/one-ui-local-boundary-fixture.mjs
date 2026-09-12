#!/usr/bin/env node

/**
 * Deterministic boundary fixture for local pagination QA.
 *
 * The default mode is `manifest` and never opens a database connection.  The
 * `seed` mode is intentionally explicit and is fail-closed to the one
 * loopback Postgres target used by the local3217 harness.  It inserts through
 * parameterized SQL in one bounded transaction; it does not call Payload,
 * providers, hooks, migrations, or cleanup code.
 */

import pg from "pg";

const { Pool } = pg;

const TARGET = Object.freeze({
  database: "seo_automation_browser_20260912",
  host: "127.0.0.1",
  port: 55432,
  role: "phase2b_qa",
  url: "postgresql://phase2b_qa@127.0.0.1:55432/seo_automation_browser_20260912",
  browserBaseUrl: "http://127.0.0.1:3217",
});

const MARKER = "boundary-20260912";
const LEAD_COUNT = 325;
const SELECTIVE_LEAD_COUNT = 26;
const OWNER_VERSION_COUNT = 126;
const MESSAGE_COUNT = 126;
const MEDIA_DECOY_COUNT = 501;
const MEDIA_ANCHOR_COUNT = 101;
const INVOICE_OWNER_ORDINALS = [31, 32];

const requiredColumns = Object.freeze({
  leads: ["name", "email", "address", "postal", "inquiry_type", "language", "record_state", "next_action_owner", "case_revision"],
  messages: ["lead_id", "direction", "category", "channel", "subject", "body_text", "idempotency_key"],
  private_media: ["classification", "owner_type", "owner_id", "filename", "mime_type", "filesize"],
  price_rules: ["reference", "version", "service_key", "unit_price_ex_vat_ore", "valid_from", "terms_version"],
  // The local3217 database intentionally has no roof_measurements.version.
  // Version boundaries are exercised by quotes/contracts below.
  roof_measurements: ["reference", "lead_id", "normalized_address", "latitude", "longitude", "captured_at", "roof_planes", "horizontal_area_tenths", "actual_area_min_tenths", "actual_area_max_tenths", "calculation_snapshot", "input_hash", "confidence", "confidence_reasoning"],
  price_calculations: ["reference", "lead_id", "measurement_id", "price_rule_id", "input_snapshot", "output_snapshot", "input_hash", "subtotal_ex_vat_ore", "vat_ore", "total_inc_vat_ore"],
  quotes: ["reference", "lead_id", "measurement_id", "price_calculation_id", "version", "snapshot", "snapshot_hash", "service_description", "total_inc_vat_ore", "terms_version", "valid_until"],
  contracts: ["reference", "quote_id", "version", "snapshot", "document_hash", "terms_version"],
  work_orders: ["reference", "lead_id", "quote_id", "contract_id", "status", "work_summary"],
  invoice_records: ["reference", "lead_id", "work_order_id", "snapshot", "document_hash", "subtotal_ex_vat_ore", "vat_ore", "total_inc_vat_ore", "issued_at", "due_at", "assigned_to_id"],
  warranties: ["reference", "lead_id", "work_order_id", "scope", "starts_at", "ends_at", "terms_version", "snapshot", "document_hash", "approved_by_id", "approved_at"],
  official_invoices: ["reference", "lead_id", "work_order_id", "invoice_record_id", "original_document_id", "original_hash"],
  customer_contract_requests: ["reference", "lead_id", "quote_id", "contract_id", "kind", "reason_code", "source_message_id", "request_fingerprint"],
});

const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
const json = (value) => JSON.stringify(value);
const iso = (daysAgo) => new Date(Date.UTC(2026, 7, 1, 12, 0, 0) - daysAgo * 86400000).toISOString();

function manifest() {
  return {
    marker: MARKER,
    target: {
      database: TARGET.database,
      host: TARGET.host,
      port: TARGET.port,
      role: TARGET.role,
      browserBaseUrl: TARGET.browserBaseUrl,
    },
    boundedCounts: {
      leads: LEAD_COUNT,
      selectiveFilterLeads: SELECTIVE_LEAD_COUNT,
      messagesOnAnchorLead: MESSAGE_COUNT,
      ownerVersions: OWNER_VERSION_COUNT,
      measurements: OWNER_VERSION_COUNT,
      priceCalculations: OWNER_VERSION_COUNT,
      quotes: OWNER_VERSION_COUNT,
      contracts: OWNER_VERSION_COUNT,
      workOrders: OWNER_VERSION_COUNT,
      invoiceRecords: OWNER_VERSION_COUNT,
      warranties: OWNER_VERSION_COUNT,
      officialInvoices: OWNER_VERSION_COUNT,
      contractRequests: OWNER_VERSION_COUNT,
      anchorPrivateMedia: MEDIA_ANCHOR_COUNT,
      privateMediaDecoys: MEDIA_DECOY_COUNT,
    },
    invoiceOwnerLeadOrdinals: INVOICE_OWNER_ORDINALS,
    ownerTypes: ["roof-measurement", "quote", "contract", "work-order", "invoice-record", "warranty"],
    boundaryAssertions: [
      "All 325 lead rows are marker-scoped; no baseline row count is assumed.",
      "The first anchor media row is older than all 501 decoys in private_media.",
      "The 501 decoys are actual private_media source rows: 500 work-order owners plus one work owner reusing decoy owner 500.",
      "The 126 messages belong to one anchor lead, exercising history over the old 100-row cap.",
      "The 126 measurements do not write a version column: local3217 has no roof_measurements.version; quote/contract versions carry the boundary.",
      "The fixture is QA data only; signed/issued states are not evidence of legal signing or invoice validity.",
    ],
    expectedCurrentCodeFailures: [
      "Newest-first private_media LIMIT 500 can omit the oldest anchor owner document.",
      "A case-history LIMIT 100 can omit the oldest of 126 messages.",
      "A case-list related global LIMIT 100 can starve related state for older leads on a 25-lead page.",
      "Action/worker post-filters can report pre-filter totals; fixture assertions must check rows across pages, not only totalDocs.",
    ],
  };
}

function assertRuntime() {
  if (process.version.localeCompare("v20.9.0", undefined, { numeric: true }) < 0) {
    throw new Error(`seed requires Node 20.9 or newer (found ${process.version})`);
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== TARGET.url) {
    throw new Error("seed refused: DATABASE_URL is not the fixed loopback target");
  }
  if (process.env.PLAYWRIGHT_BASE_URL && !process.env.PLAYWRIGHT_BASE_URL.startsWith(TARGET.browserBaseUrl)) {
    throw new Error("seed refused: browser runtime is not local3217");
  }
  const providerKeys = ["RESEND_API_KEY", "GEMINI_API_KEY", "PEXELS_API_KEY", "BLOB_READ_WRITE_TOKEN", "S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"];
  const presentProvider = providerKeys.find((key) => process.env[key]);
  if (presentProvider) throw new Error(`seed refused: provider credential ${presentProvider} is present`);
  if (!process.env.ONE_UI_BOUNDARY_FIXTURE_ACTOR) {
    throw new Error("seed refused: ONE_UI_BOUNDARY_FIXTURE_ACTOR must identify an existing local actor user id");
  }
  if (!/^\d+$/.test(process.env.ONE_UI_BOUNDARY_FIXTURE_ACTOR)) {
    throw new Error("seed refused: ONE_UI_BOUNDARY_FIXTURE_ACTOR must be a numeric existing user id");
  }
}

async function readOnlyAttestation(client) {
  await client.query("BEGIN");
  try {
    await client.query("SET TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5000'");
    const { rows } = await client.query("SELECT current_database() AS database, inet_server_addr()::text AS host, inet_server_port() AS port, current_user AS role");
    const actual = rows[0];
    if (actual.database !== TARGET.database || actual.host !== TARGET.host || Number(actual.port) !== TARGET.port || actual.role !== TARGET.role) {
      throw new Error(`seed refused: runtime attestation mismatch (${actual.database}@${actual.host}:${actual.port} as ${actual.role})`);
    }
  } finally {
    await client.query("ROLLBACK");
  }
}

async function assertSchema(client) {
  const expected = Object.entries(requiredColumns).flatMap(([table, columns]) => columns.map((column) => ({ table, column })));
  const { rows } = await client.query(
    `SELECT table_name AS table, column_name AS column
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [Object.keys(requiredColumns)],
  );
  const found = new Set(rows.map((row) => `${row.table}:${row.column}`));
  const missing = expected.filter(({ table, column }) => !found.has(`${table}:${column}`));
  if (missing.length) throw new Error(`seed refused: schema is missing ${missing.map(({ table, column }) => `${table}.${column}`).join(", ")}`);
}

async function assertActor(client, actorId) {
  const { rowCount } = await client.query("SELECT id FROM users WHERE id = $1", [actorId]);
  if (rowCount !== 1) throw new Error(`seed refused: actor user ${actorId} does not exist in the local target`);
}

async function assertMarkerAvailable(client) {
  for (const table of Object.keys(requiredColumns)) {
    const { rows } = await client.query(`SELECT count(*)::int AS count FROM ${quote(table)} WHERE to_jsonb(${quote(table)})::text LIKE $1`, [`%${MARKER}%`]);
    if (rows[0].count !== 0) throw new Error(`seed refused: marker collision in ${table}`);
  }
}

async function insertFixture(client, actorId) {
  const leads = [];
  for (let index = 1; index <= LEAD_COUNT; index += 1) {
    const selective = index <= SELECTIVE_LEAD_COUNT;
    const recordState = index <= 305 ? "active" : index <= 320 ? "archived" : "trashed";
    const { rows } = await client.query(
      `INSERT INTO leads (name,email,address,postal,inquiry_type,language,status,record_state,next_action_owner,case_revision,updated_at,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$10) RETURNING id`,
      [
        `${MARKER}-lead-${String(index).padStart(3, "0")}${selective ? "-selective" : ""}`,
        `${MARKER}-lead-${String(index).padStart(3, "0")}@example.invalid`,
        `${MARKER} address ${index}`,
        `00${String(index).padStart(3, "0")}`.slice(-4),
        "takvask",
        "no",
        selective ? "customer_waiting" : "new",
        recordState,
        "administrator",
        iso(index),
      ],
    );
    leads.push(rows[0].id);
  }

  const rule = await client.query(
    `INSERT INTO price_rules (reference,version,service_key,unit_price_ex_vat_ore,valid_from,terms_version,status)
     VALUES ($1,1,'takvask',100,$2,'${MARKER}-terms','approved') RETURNING id`,
    [`${MARKER}-price-rule`, iso(300)],
  );
  const priceRuleId = rule.rows[0].id;
  const anchorLeadId = leads[0];
  const measurements = [];
  const calculations = [];
  const quotes = [];
  const contracts = [];
  const workOrders = [];
  const invoices = [];
  const warranties = [];

  for (let index = 1; index <= OWNER_VERSION_COUNT; index += 1) {
    const suffix = String(index).padStart(3, "0");
    const leadId = leads[(index - 1) % leads.length];
    const measurement = await client.query(
      `INSERT INTO roof_measurements (reference,lead_id,normalized_address,latitude,longitude,captured_at,roof_planes,horizontal_area_tenths,actual_area_min_tenths,actual_area_max_tenths,calculation_snapshot,input_hash,confidence,confidence_reasoning,status)
       VALUES ($1,$2,$3,59.91,10.75,$4,$5,1000,1000,1100,$6,$7,'high','${MARKER} deterministic fixture','approved') RETURNING id`,
      [`${MARKER}-measurement-${suffix}`, leadId, `${MARKER} measurement address ${suffix}`, iso(400 + index), json([{ areaTenths: 1000 }]), json({ marker: MARKER, version: index }), `${MARKER}-measurement-hash-${suffix}`],
    );
    measurements.push(measurement.rows[0].id);
    const calculation = await client.query(
      `INSERT INTO price_calculations (reference,lead_id,measurement_id,price_rule_id,input_snapshot,output_snapshot,input_hash,subtotal_ex_vat_ore,vat_ore,total_inc_vat_ore,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,10000,2500,12500,'ready') RETURNING id`,
      [`${MARKER}-calculation-${suffix}`, leadId, measurement.rows[0].id, priceRuleId, json({ marker: MARKER, version: index }), json({ totalIncVatOre: 12500 }), `${MARKER}-calculation-hash-${suffix}`],
    );
    calculations.push(calculation.rows[0].id);
    const quoteResult = await client.query(
      `INSERT INTO quotes (reference,lead_id,measurement_id,price_calculation_id,version,snapshot,snapshot_hash,service_description,total_inc_vat_ore,terms_version,valid_until,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'${MARKER} service',12500,$8,$9,'accepted') RETURNING id`,
      [`${MARKER}-quote-${suffix}`, leadId, measurement.rows[0].id, calculation.rows[0].id, index, json({ marker: MARKER, version: index }), `${MARKER}-quote-hash-${suffix}`, `${MARKER}-terms`, iso(-30)],
    );
    quotes.push(quoteResult.rows[0].id);
    const contract = await client.query(
      `INSERT INTO contracts (reference,quote_id,version,snapshot,document_hash,terms_version,status)
       VALUES ($1,$2,$3,$4,$5,$6,'issued') RETURNING id`,
      [`${MARKER}-contract-${suffix}`, quoteResult.rows[0].id, index, json({ marker: MARKER, version: index }), `${MARKER}-contract-hash-${suffix}`, `${MARKER}-terms`],
    );
    contracts.push(contract.rows[0].id);
    const work = await client.query(
      `INSERT INTO work_orders (reference,lead_id,quote_id,contract_id,status,work_summary)
       VALUES ($1,$2,$3,$4,'scheduled',$5) RETURNING id`,
      [`${MARKER}-work-order-${suffix}`, leadId, quoteResult.rows[0].id, contract.rows[0].id, `${MARKER} work ${suffix}`],
    );
    workOrders.push(work.rows[0].id);
    const invoice = await client.query(
      `INSERT INTO invoice_records (reference,lead_id,work_order_id,snapshot,document_hash,subtotal_ex_vat_ore,vat_ore,total_inc_vat_ore,issued_at,due_at,assigned_to_id,status)
       VALUES ($1,$2,$3,$4,$5,10000,2500,12500,$6,$7,$8,'approved') RETURNING id`,
      [`${MARKER}-invoice-${suffix}`, leadId, work.rows[0].id, json({ marker: MARKER, version: index }), `${MARKER}-invoice-hash-${suffix}`, iso(200 + index), iso(170 + index), actorId],
    );
    invoices.push(invoice.rows[0].id);
    const warranty = await client.query(
      `INSERT INTO warranties (reference,lead_id,work_order_id,scope,starts_at,ends_at,terms_version,snapshot,document_hash,approved_by_id,approved_at,status)
       VALUES ($1,$2,$3,'${MARKER} roof scope',$4,$5,$6,$7,$8,$9,$4,'active') RETURNING id`,
      [`${MARKER}-warranty-${suffix}`, leadId, work.rows[0].id, iso(1), iso(-3650), `${MARKER}-terms`, json({ marker: MARKER, version: index }), `${MARKER}-warranty-hash-${suffix}`, actorId],
    );
    warranties.push(warranty.rows[0].id);
  }

  const media = [];
  for (let index = 1; index <= MEDIA_ANCHOR_COUNT; index += 1) {
    const ownerType = ["roof-measurement", "quote", "contract", "work-order", "invoice-record", "warranty"][(index - 1) % 6];
    const owners = { "roof-measurement": measurements, quote: quotes, contract: contracts, "work-order": workOrders, "invoice-record": invoices, warranty: warranties };
    const ownerId = owners[ownerType][(index - 1) % OWNER_VERSION_COUNT];
    const result = await client.query(
      `INSERT INTO private_media (classification,owner_type,owner_id,alt,filename,mime_type,filesize,url,created_at,updated_at)
       VALUES ('${ownerType === "roof-measurement" ? "measurement" : ownerType === "invoice-record" ? "invoice" : ownerType === "warranty" ? "warranty" : ownerType === "work-order" ? "work" : "contract"}',$1,$2,$3,$4,'application/pdf',1,$5,$6,$6) RETURNING id`,
      [ownerType, String(ownerId), `${MARKER} anchor media ${index}`, `${MARKER}-anchor-${String(index).padStart(3, "0")}.pdf`, `${TARGET.browserBaseUrl}/fixtures/${MARKER}/anchor-${index}.pdf`, iso(1000 + index)],
    );
    media.push(result.rows[0].id);
  }
  for (let index = 1; index <= MEDIA_DECOY_COUNT; index += 1) {
    const ownerType = index === MEDIA_DECOY_COUNT ? "work" : "work-order";
    const ownerIndex = index === MEDIA_DECOY_COUNT ? MEDIA_DECOY_COUNT - 1 : index;
    await client.query(
      `INSERT INTO private_media (classification,owner_type,owner_id,alt,filename,mime_type,filesize,url,created_at,updated_at)
       VALUES ('work',$1,$2,$3,$4,'application/pdf',1,$5,$6,$6)`,
      [ownerType, `${MARKER}-decoy-work-order-${String(ownerIndex).padStart(3, "0")}`, `${MARKER} decoy media ${index}`, `${MARKER}-decoy-${String(index).padStart(3, "0")}.pdf`, `${TARGET.browserBaseUrl}/fixtures/${MARKER}/decoy-${index}.pdf`, iso(index)],
    );
  }

  for (let index = 1; index <= MESSAGE_COUNT; index += 1) {
    await client.query(
      `INSERT INTO messages (lead_id,direction,category,channel,subject,body_text,status,idempotency_key,created_at,updated_at)
       VALUES ($1,'outbound','information_request','email',$2,$3,'approved',$4,$5,$5)`,
      [anchorLeadId, `${MARKER} history ${index}`, `${MARKER} message ${index}`, `${MARKER}-message-${String(index).padStart(3, "0")}`, iso(600 - index)],
    );
  }

  for (let index = 1; index <= OWNER_VERSION_COUNT; index += 1) {
    const suffix = String(index).padStart(3, "0");
    const message = await client.query(
      "SELECT id FROM messages WHERE idempotency_key = $1",
      [`${MARKER}-message-${suffix}`],
    );
    await client.query(
      `INSERT INTO official_invoices (reference,lead_id,work_order_id,invoice_record_id,original_document_id,original_hash,status,extraction_status)
       VALUES ($1,$2,$3,$4,$5,$6,'needs_review','needs_review')`,
      [`${MARKER}-official-invoice-${suffix}`, leads[(index - 1) % leads.length], workOrders[index - 1], invoices[index - 1], media[(index - 1) % media.length], `${MARKER}-official-hash-${suffix}`],
    );
    await client.query(
      `INSERT INTO customer_contract_requests (reference,lead_id,quote_id,contract_id,kind,reason_code,source_message_id,request_fingerprint)
       VALUES ($1,$2,$3,$4,'change_or_cancel','other',$5,$6)`,
      [`${MARKER}-contract-request-${suffix}`, leads[(index - 1) % leads.length], quotes[index - 1], contracts[index - 1], message.rows[0].id, `${MARKER}-request-fingerprint-${suffix}`],
    );
  }
}

async function seed() {
  assertRuntime();
  const pool = new Pool({ connectionString: TARGET.url, max: 1, application_name: "one-ui-boundary-fixture" });
  const client = await pool.connect();
  try {
    await readOnlyAttestation(client);
    await assertSchema(client);
    await assertActor(client, Number(process.env.ONE_UI_BOUNDARY_FIXTURE_ACTOR));
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '120000'");
    await client.query("SET LOCAL lock_timeout = '5000'");
    await assertMarkerAvailable(client);
    await insertFixture(client, Number(process.env.ONE_UI_BOUNDARY_FIXTURE_ACTOR));
    await client.query("COMMIT");
    process.stdout.write(`${JSON.stringify({ seeded: true, marker: MARKER, target: TARGET.database, counts: manifest().boundedCounts })}\n`);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const mode = process.argv[2] ?? "manifest";
if (mode === "manifest") {
  process.stdout.write(`${JSON.stringify(manifest(), null, 2)}\n`);
} else if (mode === "seed") {
  seed().catch((error) => {
    process.stderr.write(`one-ui-local-boundary-fixture: ${error.message}\n`);
    process.exitCode = 1;
  });
} else {
  process.stderr.write("Usage: node scripts/one-ui-local-boundary-fixture.mjs [manifest|seed]\n");
  process.exitCode = 2;
}
