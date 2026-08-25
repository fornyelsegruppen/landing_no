import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

describe("F0 isolated PostgreSQL-compatible backup and restore", () => {
  const databases: PGlite[] = [];

  afterEach(async () => {
    await Promise.all(databases.map((database) => database.close()));
    databases.length = 0;
  });

  it("restores relational case data and keeps private media references intact", async () => {
    const source = new PGlite();
    databases.push(source);
    await source.exec(`
      CREATE TABLE leads (
        id serial PRIMARY KEY,
        email varchar NOT NULL,
        status varchar NOT NULL
      );
      CREATE TABLE contracts (
        id serial PRIMARY KEY,
        lead_id integer NOT NULL REFERENCES leads(id),
        document_hash varchar NOT NULL
      );
      CREATE TABLE work_orders (
        id serial PRIMARY KEY,
        lead_id integer NOT NULL REFERENCES leads(id),
        contract_id integer NOT NULL REFERENCES contracts(id),
        status varchar NOT NULL
      );
      CREATE TABLE private_media (
        id serial PRIMARY KEY,
        lead_id integer NOT NULL REFERENCES leads(id),
        work_order_id integer REFERENCES work_orders(id),
        object_key varchar NOT NULL
      );
      INSERT INTO leads (email, status) VALUES ('qa-restore@example.invalid', 'converted');
      INSERT INTO contracts (lead_id, document_hash) VALUES (1, repeat('a', 64));
      INSERT INTO work_orders (lead_id, contract_id, status) VALUES (1, 1, 'documented');
      INSERT INTO private_media (lead_id, work_order_id, object_key) VALUES (1, 1, 'qa/private/evidence.jpg');
    `);

    const backup = await source.dumpDataDir("gzip");
    const restored = new PGlite({ loadDataDir: backup });
    databases.push(restored);
    await restored.waitReady;

    const counts = await restored.query<{ contracts: number; leads: number; media: number; workOrders: number }>(`
      SELECT
        (SELECT count(*)::int FROM leads) AS leads,
        (SELECT count(*)::int FROM contracts) AS contracts,
        (SELECT count(*)::int FROM work_orders) AS "workOrders",
        (SELECT count(*)::int FROM private_media) AS media
    `);
    expect(counts.rows).toEqual([{ leads: 1, contracts: 1, workOrders: 1, media: 1 }]);

    const relation = await restored.query<{ documentHash: string; objectKey: string; status: string }>(`
      SELECT c.document_hash AS "documentHash", w.status, m.object_key AS "objectKey"
      FROM leads l
      JOIN contracts c ON c.lead_id = l.id
      JOIN work_orders w ON w.contract_id = c.id
      JOIN private_media m ON m.work_order_id = w.id
      WHERE l.email = 'qa-restore@example.invalid'
    `);
    expect(relation.rows).toEqual([{
      documentHash: "a".repeat(64),
      objectKey: "qa/private/evidence.jpg",
      status: "documented",
    }]);
  }, 30_000);
});

