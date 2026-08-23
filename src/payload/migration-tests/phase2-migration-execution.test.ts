import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(
    new URL("../migrations/20260823_142839_phase2_accounts_worker_shell.ts", import.meta.url),
  ),
  "utf8",
);
const defaultRoleSource = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/20260823_143838_phase2_default_worker_role.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

function migrationSql(
  direction: "up" | "down",
  migrationSource: string = source,
) {
  const match = migrationSource.match(
    new RegExp(
      `export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\);`,
    ),
  );
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("phase two account migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TYPE enum_users_role AS ENUM ('admin', 'editor');
      CREATE TABLE users (
        id serial PRIMARY KEY,
        role enum_users_role DEFAULT 'admin' NOT NULL
      );
      CREATE TABLE users_sessions (
        _order integer NOT NULL,
        _parent_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        id varchar PRIMARY KEY,
        expires_at timestamptz NOT NULL
      );
      CREATE TABLE leads (id serial PRIMARY KEY);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
      INSERT INTO users (role) VALUES ('admin'), ('editor');
      INSERT INTO users_sessions (_order, _parent_id, id, expires_at)
        VALUES (1, 2, 'legacy-editor-session', now() + interval '1 day');
    `);
  });

  afterEach(async () => {
    await database.close();
  });

  it("keeps admins active and quarantines legacy editors as inactive workers", async () => {
    await database.exec(migrationSql("up"));
    await database.exec(migrationSql("up", defaultRoleSource));
    await database.exec("INSERT INTO users DEFAULT VALUES");

    const users = await database.query<{
      active: boolean;
      id: number;
      role: string;
    }>("SELECT id, role::text, active FROM users ORDER BY id");
    const sessions = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM users_sessions",
    );

    expect(users.rows).toEqual([
      { id: 1, role: "admin", active: true },
      { id: 2, role: "worker", active: false },
      { id: 3, role: "worker", active: true },
    ]);
    expect(sessions.rows[0]?.count).toBe(0);
  }, 30_000);

  it("creates the assignment model and rolls back without invalid role casts", async () => {
    await database.exec(migrationSql("up"));
    await database.exec(migrationSql("up", defaultRoleSource));
    await database.exec(`
      INSERT INTO work_orders (reference, assigned_worker_id)
      VALUES ('TEST-001', 2);
    `);

    const work = await database.query<{ reference: string }>(
      "SELECT reference FROM work_orders",
    );
    expect(work.rows).toEqual([{ reference: "TEST-001" }]);

    await database.exec(migrationSql("down", defaultRoleSource));
    await database.exec(migrationSql("down"));
    const roles = await database.query<{ role: string }>(
      "SELECT role::text FROM users ORDER BY id",
    );
    expect(roles.rows).toEqual([{ role: "admin" }, { role: "editor" }]);
  }, 30_000);
});
