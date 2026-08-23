/**
 * Force drizzle schema push to Postgres (emergency / new collections).
 * Prefer versioned migrations when possible.
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import pg from "pg";
import { postgresSslOptions } from "./postgres-ssl.mjs";

process.env.NODE_ENV = "development";
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = "true";

const baselineCurrentMigrations = process.argv.includes(
  "--baseline-current-migrations",
);
const rawDatabaseUrl =
  process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL ?? "";
const databaseUrl = rawDatabaseUrl.replace(
  /[&?]channel_binding=require/g,
  "",
);

if (baselineCurrentMigrations) {
  if (!databaseUrl.startsWith("postgres")) {
    throw new Error(
      "Empty database bootstrap requires a PostgreSQL DATABASE_URL.",
    );
  }

  const preflightPool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 20_000,
    ssl: postgresSslOptions(databaseUrl),
  });
  try {
    const result = await preflightPool.query(`
      select count(*)::integer as table_count
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
    `);
    const tableCount = Number(result.rows[0]?.table_count ?? 0);
    if (tableCount !== 0) {
      throw new Error(
        `Refusing empty database bootstrap: public schema already has ${tableCount} table(s). Use versioned migrations instead.`,
      );
    }
  } finally {
    await preflightPool.end();
  }
}

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jiti = require("jiti")(import.meta.url, {
  esmResolve: true,
  interopDefault: true,
  tsconfigPaths: path.resolve(__dirname, "../tsconfig.json"),
});

const configModule = await jiti.import(
  path.resolve(__dirname, "../src/payload.config.ts"),
);
const config = configModule.default ?? configModule;

const { getPayload } = await import("payload");
const payload = await getPayload({ config });

if (baselineCurrentMigrations) {
  const migrationModule = await jiti.import(
    path.resolve(__dirname, "../src/payload/migrations/index.ts"),
  );
  const migrations = migrationModule.migrations ?? [];
  const baselineClient = await payload.db.pool.connect();
  try {
    await baselineClient.query("BEGIN");
    await baselineClient.query(
      `delete from payload_migrations where batch = -1`,
    );
    for (const migration of migrations) {
      await baselineClient.query(
        `insert into payload_migrations (name, batch)
         select $1, 1
         where not exists (
           select 1 from payload_migrations where name = $1 and batch <> -1
         )`,
        [migration.name],
      );
    }
    await baselineClient.query("COMMIT");
    console.log(
      `Recorded ${migrations.length} current migration(s) as the baseline for the new empty database.`,
    );
  } catch (error) {
    await baselineClient.query("ROLLBACK");
    throw error;
  } finally {
    baselineClient.release();
  }
}

const client = await payload.db.pool.connect();
try {
  const { rows } = await client.query(
    `select tablename from pg_tables where schemaname = 'public' order by 1`,
  );
  console.log(
    "Schema push finished. Public tables:",
    rows.map((row) => row.tablename).join(", "),
  );
} finally {
  client.release();
  await payload.db.destroy();
}

process.exit(0);
