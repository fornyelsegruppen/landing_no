/**
 * @deprecated Prefer versioned Payload migrations (`npm run db:migrate`).
 * Kept as an emergency fallback for Leads column drift.
 *
 * Keep Leads table aligned with the two-step contact form.
 * Usage: node --env-file=.env scripts/migrate-leads-columns.mjs
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

async function renameIfNeeded(from, to) {
  const existsFrom = await pool.query(
    `select 1 from information_schema.columns
     where table_schema='public' and table_name='leads' and column_name=$1`,
    [from],
  );
  const existsTo = await pool.query(
    `select 1 from information_schema.columns
     where table_schema='public' and table_name='leads' and column_name=$1`,
    [to],
  );

  if (existsFrom.rowCount && !existsTo.rowCount) {
    await pool.query(`alter table leads rename column "${from}" to "${to}"`);
    console.log(`renamed ${from} -> ${to}`);
  } else if (existsTo.rowCount) {
    console.log(`ok: ${to} already exists`);
    if (existsFrom.rowCount) {
      await pool.query(`alter table leads drop column "${from}"`);
      console.log(`dropped leftover ${from}`);
    }
  } else {
    console.log(`skip: neither ${from} nor ${to} found as expected`);
  }
}

async function ensureColumn(column, sqlType) {
  const exists = await pool.query(
    `select 1 from information_schema.columns
     where table_schema='public' and table_name='leads' and column_name=$1`,
    [column],
  );
  if ((exists.rowCount ?? 0) > 0) {
    console.log(`ok: leads.${column}`);
    return;
  }
  await pool.query(`alter table leads add column "${column}" ${sqlType}`);
  console.log(`added: leads.${column}`);
}

async function dropNotNull(column) {
  await pool.query(`alter table leads alter column "${column}" drop not null`);
  console.log(`nullable: leads.${column}`);
}

async function ensureEnumValue(label) {
  const exists = await pool.query(
    `select 1 from pg_enum e
     join pg_type t on t.oid = e.enumtypid
     where t.typname = 'enum_leads_type' and e.enumlabel = $1`,
    [label],
  );
  if ((exists.rowCount ?? 0) > 0) {
    console.log(`ok enum: ${label}`);
    return;
  }
  await pool.query(
    `alter type enum_leads_type add value if not exists '${label}'`,
  );
  console.log(`added enum: ${label}`);
}

try {
  await renameIfNeeded("type", "inquiry_type");
  await renameIfNeeded("locale", "language");

  await ensureColumn("approx_sqm", "numeric");
  await ensureColumn("photo_urls", "varchar");

  for (const label of [
    "takvask",
    "impregnering",
    "takmaling",
    "nytt_tak",
    "usikker",
    "vedlikehold",
    "kledning",
  ]) {
    await ensureEnumValue(label);
  }

  // Two-step form: phone or email is required by API validation; phone stays nullable.
  for (const column of ["email", "phone", "house_number", "city", "message"]) {
    try {
      await dropNotNull(column);
    } catch (err) {
      console.log(
        `skip nullable ${column}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const cols = await pool.query(
    `select column_name, is_nullable from information_schema.columns
     where table_schema='public' and table_name='leads' order by ordinal_position`,
  );
  console.log(
    "leads columns:",
    cols.rows.map((r) => `${r.column_name}(null=${r.is_nullable})`).join(", "),
  );

  const enums = await pool.query(
    `select e.enumlabel from pg_type t
     join pg_enum e on t.oid = e.enumtypid
     where t.typname = 'enum_leads_type' order by e.enumsortorder`,
  );
  console.log(
    "enum_leads_type:",
    enums.rows.map((r) => r.enumlabel).join(", "),
  );
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
