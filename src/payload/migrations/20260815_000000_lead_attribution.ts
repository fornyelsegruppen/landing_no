import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_source" varchar`,
  );
  await db.execute(
    sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_medium" varchar`,
  );
  await db.execute(
    sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar`,
  );
  await db.execute(
    sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_content" varchar`,
  );
  await db.execute(
    sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_term" varchar`,
  );
  await db.execute(
    sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "gclid" varchar`,
  );
  await db.execute(
    sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "fbclid" varchar`,
  );
  await db.execute(
    sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "landing_page" varchar`,
  );
  await db.execute(
    sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "referrer" varchar`,
  );
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "leads" DROP COLUMN IF EXISTS "utm_source"`);
  await db.execute(sql`ALTER TABLE "leads" DROP COLUMN IF EXISTS "utm_medium"`);
  await db.execute(
    sql`ALTER TABLE "leads" DROP COLUMN IF EXISTS "utm_campaign"`,
  );
  await db.execute(
    sql`ALTER TABLE "leads" DROP COLUMN IF EXISTS "utm_content"`,
  );
  await db.execute(sql`ALTER TABLE "leads" DROP COLUMN IF EXISTS "utm_term"`);
  await db.execute(sql`ALTER TABLE "leads" DROP COLUMN IF EXISTS "gclid"`);
  await db.execute(sql`ALTER TABLE "leads" DROP COLUMN IF EXISTS "fbclid"`);
  await db.execute(
    sql`ALTER TABLE "leads" DROP COLUMN IF EXISTS "landing_page"`,
  );
  await db.execute(sql`ALTER TABLE "leads" DROP COLUMN IF EXISTS "referrer"`);
}
