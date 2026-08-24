/**
 * @deprecated Prefer versioned Payload migrations (`npm run db:migrate`).
 * Kept as an emergency fallback if a production column is missing and a
 * proper migration has not been created yet.
 *
 * Ensure CMS columns exist for editable Site Settings + project/media uploads.
 *
 * Usage: node --env-file=.env scripts/ensure-cms-schema.mjs
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url?.startsWith("postgres")) {
  console.error("DATABASE_URL must be postgres");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 20000,
  ssl: { rejectUnauthorized: false },
});

async function columnExists(table, column) {
  const res = await pool.query(
    `select 1 from information_schema.columns
     where table_schema='public' and table_name=$1 and column_name=$2`,
    [table, column],
  );
  return (res.rowCount ?? 0) > 0;
}

async function ensureColumn(table, column, sqlType) {
  if (await columnExists(table, column)) {
    console.log(`ok: ${table}.${column}`);
    return;
  }
  await pool.query(`alter table "${table}" add column "${column}" ${sqlType}`);
  console.log(`added: ${table}.${column}`);
}

try {
  const tables = await pool.query(
    `select tablename from pg_tables where schemaname='public' order by 1`,
  );
  console.log(
    "tables:",
    tables.rows.map((r) => r.tablename).join(", "),
  );

  await ensureColumn("site_settings", "hero_image_url", "varchar");
  await ensureColumn("site_settings", "about_image_url", "varchar");
  await ensureColumn("site_settings", "new_roof_image_url", "varchar");
  await ensureColumn("site_settings", "hero_image_id", "integer");
  await ensureColumn("site_settings", "about_image_id", "integer");
  await ensureColumn("site_settings", "new_roof_image_id", "integer");

  const mediaSizeCols = [
    ["sizes_card_url", "varchar"],
    ["sizes_card_width", "numeric"],
    ["sizes_card_height", "numeric"],
    ["sizes_card_mime_type", "varchar"],
    ["sizes_card_filesize", "numeric"],
    ["sizes_card_filename", "varchar"],
    ["sizes_hero_url", "varchar"],
    ["sizes_hero_width", "numeric"],
    ["sizes_hero_height", "numeric"],
    ["sizes_hero_mime_type", "varchar"],
    ["sizes_hero_filesize", "numeric"],
    ["sizes_hero_filename", "varchar"],
  ];
  for (const [col, typ] of mediaSizeCols) {
    await ensureColumn("media", col, typ);
  }

  const stageTables = await pool.query(
    `select tablename from pg_tables
     where schemaname='public' and tablename like '%projects%stages%'`,
  );
  for (const row of stageTables.rows) {
    const t = row.tablename;
    await ensureColumn(t, "image_url", "varchar");
    await ensureColumn(t, "image_id", "integer");
  }

  const settingsCols = await pool.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='site_settings' order by 1`,
  );
  console.log(
    "site_settings columns:",
    settingsCols.rows.map((r) => r.column_name).join(", "),
  );

  for (const table of ["services", "projects", "products", "faq", "media"]) {
    const exists = tables.rows.some((r) => r.tablename === table);
    if (!exists) {
      console.log(`missing table: ${table}`);
      continue;
    }
    const count = await pool.query(`select count(*)::int as c from "${table}"`);
    console.log(`${table}: ${count.rows[0].c} rows`);
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
