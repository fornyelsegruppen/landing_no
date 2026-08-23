/**
 * Force drizzle schema push to Postgres (emergency / new collections).
 * Prefer versioned migrations when possible.
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

process.env.NODE_ENV = "development";
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = "true";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jiti = require("jiti")(import.meta.url, {
  esmResolve: true,
  interopDefault: true,
  tsconfigPaths: path.resolve(__dirname, "../tsconfig.json"),
});

const config = jiti(path.resolve(__dirname, "../src/payload.config.ts")).default;

const { getPayload } = await import("payload");
const payload = await getPayload({ config });

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
