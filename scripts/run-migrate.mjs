/**
 * Run pending Payload migrations against DATABASE_URL.
 * Skips gracefully when not using Postgres (e.g. local SQLite).
 *
 * Clears the drizzle-push "dev" marker (batch = -1) so migrate can run
 * non-interactively in CI / Vercel builds.
 *
 * Usage:
 *   npm run db:migrate
 *   npm run build:migrate
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import pg from "pg";
import { postgresSslOptions } from "./postgres-ssl.mjs";

const rawUrl =
  process.env.DATABASE_URL_MIGRATE ||
  process.env.DATABASE_URL ||
  "file:./takfornying.db";
const databaseUrl = rawUrl;

if (!databaseUrl.startsWith("postgres")) {
  console.log(
    `Skipping migrations (DATABASE_URL is not Postgres: ${databaseUrl.slice(0, 32)}…).`,
  );
  process.exit(0);
}

process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "production";
process.env.PAYLOAD_MIGRATING = "true";
process.env.CI = process.env.CI || "true";

// Remove drizzle-push marker so Payload does not prompt interactively.
const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 20_000,
  ssl: postgresSslOptions(databaseUrl),
});

try {
  const exists = await pool.query(`
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'payload_migrations'
  `);
  if ((exists.rowCount ?? 0) > 0) {
    const cleared = await pool.query(
      `delete from payload_migrations where batch = -1 returning name`,
    );
    if (cleared.rowCount) {
      console.log(
        `Cleared drizzle-push marker(s): ${cleared.rows.map((r) => r.name).join(", ")}`,
      );
    }
  }
} finally {
  await pool.end();
}

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jiti = require("jiti")(import.meta.url, {
  esmResolve: true,
  interopDefault: true,
  tsconfigPaths: path.resolve(__dirname, "../tsconfig.json"),
});

// Use Jiti's async loader because the Payload config conditionally imports the
// active database adapter with top-level await. The sync loader rewrites that
// await into invalid CommonJS when Vercel runs the migration on Node 24.
const configModule = await jiti.import(
  path.resolve(__dirname, "../src/payload.config.ts"),
);
const config = configModule.default ?? configModule;
const { migrations } = await jiti.import(
  path.resolve(__dirname, "../src/payload/migrations/index.ts"),
);

const { getPayload } = await import("payload");
const payload = await getPayload({ config });

try {
  if (typeof payload.db.migrate === "function") {
    // Pass migrations explicitly — avoids Payload's VM dynamicImport of .ts files.
    await payload.db.migrate({ migrations });
  }
  console.log("Migrations complete.");
} catch (err) {
  console.error("Migration failed:", err);
  await payload.db.destroy().catch(() => undefined);
  process.exit(1);
}

await payload.db.destroy();
process.exit(0);
