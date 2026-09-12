/** Read-only acceptance against the one explicitly approved local QA target. */
import assert from "node:assert/strict";
import pg from "pg";
import type { Payload } from "payload";
import { loadAdminCaseList } from "../src/lib/admin-v2/case-list";
import { loadCaseDocumentHistory } from "../src/lib/admin-v2/case-document-history";
import { loadCaseCurrentSelection } from "../src/lib/admin-v2/case-current-selection";
import { loadAdminDocumentRegister } from "../src/lib/admin-v2/document-register";
import { adminDocumentTypes } from "../src/lib/admin-v2/documents";
import { withAdminReadConnection } from "../src/lib/admin-v2/admin-read-db";
import {
  assertCurrentQuoteTarget,
  assertCurrentContractTarget,
  assertWorkOrderContractTarget,
  StaleCommercialContextError,
} from "../src/lib/admin-v2/commercial-action-guard";

const pool = new pg.Pool({
  connectionString:
    "postgresql://phase2b_qa@127.0.0.1:55432/seo_automation_browser_20260912",
  max: 1,
  connectionTimeoutMillis: 5000,
});
const marker = "boundary-20260912";
const payload = { db: { name: "postgres", pool } } as unknown as Payload;

async function main() {
  const client = await pool.connect();
  let admin: { id: number; role: string; active: boolean };
  let workerId: number;
  let anchorId: number;
  let matchId: number;
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout='5s'");
    const identity = (
      await client.query(
        "SELECT current_database() AS db,host(inet_server_addr()) AS host,inet_server_port() AS port,current_user AS role",
      )
    ).rows[0];
    assert.deepEqual(identity, {
      db: "seo_automation_browser_20260912",
      host: "127.0.0.1",
      port: 55432,
      role: "phase2b_qa",
    });
    admin = (await client.query("SELECT id,role,active FROM users WHERE id=1"))
      .rows[0];
    assert.equal(admin.role, "admin");
    assert.equal(admin.active, true);
    const worker = (
      await client.query(
        "SELECT id,role,active,hash IS NULL AND salt IS NULL AS no_credentials FROM users WHERE email=$1",
        [`${marker}-worker@example.invalid`],
      )
    ).rows[0];
    assert.equal(worker.role, "worker");
    assert.equal(worker.no_credentials, true);
    workerId = worker.id;
    anchorId = (
      await client.query("SELECT id FROM leads WHERE name=$1", [
        `${marker}-lead-001-selective`,
      ])
    ).rows[0].id;
    matchId = (
      await client.query("SELECT id FROM leads WHERE name=$1", [
        `${marker}-lead-026-selective`,
      ])
    ).rows[0].id;
    const counts = (
      await client.query(
        `SELECT
      (SELECT count(*)::int FROM leads WHERE name LIKE $1) AS leads,
      (SELECT count(*)::int FROM messages WHERE lead_id=$2) AS messages,
      (SELECT count(*)::int FROM quotes WHERE lead_id=$2) AS quotes,
      (SELECT count(*)::int FROM contracts c JOIN quotes q ON q.id=c.quote_id WHERE q.lead_id=$2) AS contracts,
      (SELECT count(*)::int FROM invoice_records WHERE lead_id=$2) AS invoices,
      (SELECT count(*)::int FROM private_media WHERE filename LIKE $3) AS anchor_media,
      (SELECT count(*)::int FROM private_media m JOIN work_orders w ON m.owner_id=w.id::text WHERE m.filename LIKE $4 AND w.lead_id=$5) AS joined_decoys`,
        [
          `${marker}%`,
          anchorId,
          `${marker}-anchor-%`,
          `${marker}-decoy-%`,
          matchId,
        ],
      )
    ).rows[0];
    assert.deepEqual(counts, {
      leads: 325,
      messages: 126,
      quotes: 126,
      contracts: 126,
      invoices: 126,
      anchor_media: 756,
      joined_decoys: 501,
    });
    const invoiceOwners = (
      await client.query(
        "SELECT i.id,i.lead_id,i.document_id,m.owner_type,m.owner_id FROM invoice_records i JOIN private_media m ON m.id=i.document_id WHERE i.reference=ANY($1::text[]) ORDER BY i.id",
        [[`${marker}-invoice-031`, `${marker}-invoice-032`]],
      )
    ).rows;
    assert.equal(invoiceOwners.length, 2);
    for (const row of invoiceOwners) {
      assert.equal(row.lead_id, anchorId);
      assert.equal(row.owner_type, "invoice-record");
      assert.equal(row.owner_id, String(row.id));
    }
    const posts = (
      await client.query("SELECT id FROM posts ORDER BY id")
    ).rows.map((row) => row.id);
    assert.equal(posts.length, 4, "SEO fixture post count must remain four");
    console.log(
      JSON.stringify({
        identity,
        counts,
        invoiceOwners,
        preservedSeoPostIds: posts,
      }),
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }

  for (const filters of [{ workerId }, { action: "assign_worker" as const }]) {
    const page = await loadAdminCaseList(
      payload,
      { query: `${marker}-lead`, ...filters },
      { page: 1, limit: 25 },
      admin,
    );
    assert.equal(page.totalDocs, 1);
    assert.deepEqual(
      page.items.map((item) => item.id),
      [matchId],
    );
  }
  const selective = await loadAdminCaseList(
    payload,
    { query: "selective" },
    { page: 1, limit: 25 },
    admin,
  );
  assert.equal(selective.totalDocs, 26);
  assert.equal(selective.items.length, 25);
  const owners = new Set<string>();
  const mediaIds = new Set<number>();
  for (let number = 1; number <= 31; number += 1) {
    const page = await loadCaseDocumentHistory(
      payload,
      admin,
      anchorId,
      number,
    );
    assert.equal(page.totalDocs, 756);
    assert.ok(page.items.length <= 25);
    for (const item of page.items) {
      assert.ok(!mediaIds.has(item.id));
      mediaIds.add(item.id);
      owners.add(`${item.ownerType}:${item.ownerId}`);
    }
  }
  assert.equal(mediaIds.size, 756);
  assert.equal(owners.size, 756);
  const current = await loadCaseCurrentSelection(payload, admin, anchorId);
  assert.ok(current.effectiveContractId);
  assert.notEqual(current.effectiveContractId, current.workingContractId);
  const guardPayload = {
    ...payload,
    findByID: async ({ collection, id }: { collection: string; id: number }) =>
      withAdminReadConnection(payload, admin, async (connection) => {
        assert.ok(collection === "quotes" || collection === "contracts");
        const projection =
          collection === "quotes"
            ? `id,lead_id AS lead,reference,version,status,snapshot_hash AS "snapshotHash",created_at::text AS "createdAt"`
            : `id,quote_id AS quote,reference,version,status,document_hash AS "documentHash",signed_at::text AS "signedAt",company_signed_at::text AS "companySignedAt",signed_document_id AS "signedDocument",company_signed_document_id AS "companySignedDocument",created_at::text AS "createdAt"`;
        const result = await connection.query(
          `SELECT ${projection} FROM ${collection} WHERE id=$1`,
          [id],
        );
        assert.equal(result.rows.length, 1);
        // Payload converts its numeric version field to a JS number; pg alone
        // intentionally returns NUMERIC as text.
        return { ...result.rows[0], version: Number(result.rows[0].version) };
      }),
  } as unknown as Payload;
  assert.ok(current.workingQuoteId);
  assert.ok(current.workingContractId);
  const quoteGuard = await assertCurrentQuoteTarget(guardPayload, admin, {
    leadId: anchorId,
    quoteId: current.workingQuoteId,
    expectedVersion: 126,
  });
  const contractGuard = await assertCurrentContractTarget(guardPayload, admin, {
    leadId: anchorId,
    contractId: current.workingContractId,
    expectedVersion: 126,
  });
  assert.equal(quoteGuard.effectiveContract?.id, current.effectiveContractId);
  assert.equal(contractGuard.workingContract?.id, current.workingContractId);
  await assert.rejects(
    () =>
      assertWorkOrderContractTarget(guardPayload, admin, {
        leadId: anchorId,
        contractId: current.effectiveContractId!,
      }),
    (error) =>
      error instanceof StaleCommercialContextError &&
      error.currentReference === `${marker}-contract-126`,
  );

  let register = await loadAdminDocumentRegister(payload, admin);
  for (let page = 2; page <= 6; page += 1) {
    assert.ok(register.nextCursor);
    register = await loadAdminDocumentRegister(
      payload,
      admin,
      {},
      register.nextCursor,
    );
  }
  const mixedIds = register.items.map((item) => item.id);
  const mixedTypes = [...new Set(register.items.map((item) => item.type))];
  assert.ok(
    mixedTypes.length >= 2,
    "Page six must span multiple logical types",
  );
  assert.ok(register.nextCursor);
  const following = await loadAdminDocumentRegister(
    payload,
    admin,
    {},
    register.nextCursor,
  );
  assert.ok(following.previousCursor);
  const previous = await loadAdminDocumentRegister(
    payload,
    admin,
    {},
    following.previousCursor,
    "backward",
  );
  assert.deepEqual(
    previous.items.map((item) => item.id),
    mixedIds,
  );
  const typeCounts: Record<string, number> = {};
  for (const type of adminDocumentTypes.filter((type) => type !== "all")) {
    const page = await loadAdminDocumentRegister(payload, admin, { type });
    assert.ok(page.items.every((item) => item.type === type));
    typeCounts[type] = page.items.length;
  }
  const oldFile = await loadAdminDocumentRegister(payload, admin, {
    query: `${marker}-anchor-185.pdf`,
    type: "invoice_draft",
  });
  assert.equal(oldFile.items.length, 1);
  assert.equal(oldFile.items[0].href, "/api/admin/media/185");
  console.log(
    JSON.stringify({
      pass: true,
      registryExactMatch: matchId,
      historyDocs: mediaIds.size,
      historyOwners: owners.size,
      current,
      mixedPageTypes: mixedTypes,
      roundTripIds: mixedIds,
      typePageCounts: typeCounts,
      oldFileHref: oldFile.items[0].href,
      scope: "real PostgreSQL reads only; no browser or PDF-byte acceptance",
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
