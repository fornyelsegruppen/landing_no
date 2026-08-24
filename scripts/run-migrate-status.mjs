/**
 * Show Payload migration status for DATABASE_URL.
 *
 * Usage:
 *   npm run db:migrate:status
 */
import path from "path";
import pg from "pg";
import { postgresSslOptions } from "./postgres-ssl.mjs";

const rawUrl =
  process.env.DATABASE_URL_MIGRATE ||
  process.env.DATABASE_URL ||
  "file:./takfornying.db";
const databaseUrl = rawUrl;

if (!databaseUrl.startsWith("postgres")) {
  console.log("Migration status requires a Postgres DATABASE_URL.");
  process.exit(0);
}

process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "production";
process.env.PAYLOAD_MIGRATING = "true";

// Status only — do not prompt. Read rows via pg if Payload would block.
const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 20_000,
  ssl: postgresSslOptions(databaseUrl),
});

try {
  const rows = await pool.query(
    `select id, name, batch, created_at from payload_migrations order by id`,
  );
  console.log("payload_migrations:");
  for (const row of rows.rows) {
    console.log(
      `  [${row.batch}] ${row.name} (id=${row.id}, at=${row.created_at?.toISOString?.() ?? row.created_at})`,
    );
  }

  // List filesystem migrations from index without initing Payload (avoids prompt).
  const { createRequire } = await import("module");
  const { fileURLToPath } = await import("url");
  const require = createRequire(import.meta.url);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const jiti = require("jiti")(import.meta.url, {
    esmResolve: true,
    interopDefault: true,
    tsconfigPaths: path.resolve(__dirname, "../tsconfig.json"),
  });
  const indexPath = path.resolve(
    __dirname,
    "../src/payload/migrations/index.ts",
  );
  const indexMod = jiti(indexPath);
  const fileMigrations = indexMod.migrations ?? [];
  console.log("\nfilesystem migrations:");
  for (const m of fileMigrations) {
    const applied = rows.rows.some((r) => r.name === m.name && Number(r.batch) !== -1);
    console.log(`  ${applied ? "✓" : "•"} ${m.name}`);
  }
} finally {
  await pool.end();
}

process.exit(0);
