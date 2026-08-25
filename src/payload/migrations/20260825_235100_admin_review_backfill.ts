import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "leads"
    SET "admin_reviewed_at" = COALESCE("updated_at", "created_at", now())
    WHERE "admin_reviewed_at" IS NULL;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "leads"
    SET "admin_reviewed_at" = NULL
    WHERE "admin_reviewed_by_id" IS NULL;
  `);
}
