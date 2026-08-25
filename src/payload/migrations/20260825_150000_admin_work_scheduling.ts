import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "work_orders" ADD COLUMN "arrival_window" varchar;
    ALTER TABLE "work_orders" ADD COLUMN "admin_note" varchar;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "work_orders" DROP COLUMN "arrival_window";
    ALTER TABLE "work_orders" DROP COLUMN "admin_note";
  `);
}
