/**
 * Create a Payload baseline migration (no-op UP) + Drizzle schema snapshot.
 *
 * Avoids `--import tsx` because it breaks Payload's `payload/node` → `@next/env` load.
 * Uses jiti to load the TypeScript config instead.
 *
 * Usage:
 *   npm run db:migrate:baseline
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

// Keep push disabled — drizzle push hangs/locks on large Neon schemas.
process.env.NODE_ENV = "production";
process.env.PAYLOAD_MIGRATING = "true";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jiti = require("jiti")(import.meta.url, {
  esmResolve: true,
  interopDefault: true,
  tsconfigPaths: path.resolve(__dirname, "../tsconfig.json"),
});

const migrationsDir = path.resolve(__dirname, "../src/payload/migrations");

const configModule = jiti(path.resolve(__dirname, "../src/payload.config.ts"));
const config = configModule.default ?? configModule;

const { getPayload } = await import("payload");
const payload = await getPayload({ config });

if (typeof payload.db.requireDrizzleKit !== "function") {
  console.error("Baseline requires Postgres adapter with Drizzle Kit support.");
  await payload.db.destroy();
  process.exit(1);
}

const { generateDrizzleJson } = payload.db.requireDrizzleKit();
const drizzleJson = await generateDrizzleJson(payload.db.schema);

fs.mkdirSync(migrationsDir, { recursive: true });

const stamp = "20260727_000000";
const name = "baseline";
const base = path.join(migrationsDir, `${stamp}_${name}`);

const ts = `import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Baseline migration for the existing Takfornyelse schema.
 *
 * Production tables were originally created via drizzle push + ensure-*.mjs
 * scripts. This file freezes that state so future schema changes go through
 * versioned migrations instead of ad-hoc ALTER scripts.
 *
 * UP is intentionally a no-op (safe on DBs that already have the schema).
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  payload.logger.info('Baseline migration: schema already present — recording only.')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Baseline down is a no-op (will not drop existing tables).')
}
`;

fs.writeFileSync(`${base}.ts`, ts);
fs.writeFileSync(`${base}.json`, JSON.stringify(drizzleJson, null, 2));

function writeMigrationIndex() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .sort();

  const imports = files
    .map((f, i) => `import * as migration_${i} from './${f.replace(/\.ts$/, "")}'`)
    .join("\n");

  const exportsList = files
    .map((f, i) => {
      const migrationName = f.replace(/\.ts$/, "");
      return `  {
    up: migration_${i}.up,
    down: migration_${i}.down,
    name: '${migrationName}',
  }`;
    })
    .join(",\n");

  fs.writeFileSync(
    path.join(migrationsDir, "index.ts"),
    `${imports}\n\nexport const migrations = [\n${exportsList},\n]\n`,
  );

  return files.length;
}

const count = writeMigrationIndex();

console.log(`Wrote ${base}.ts`);
console.log(
  `Wrote ${base}.json (drizzle snapshot, ${Math.round(fs.statSync(`${base}.json`).size / 1024)} KB)`,
);
console.log(`Updated migrations/index.ts (${count} migration(s))`);

await payload.db.destroy();
process.exit(0);
