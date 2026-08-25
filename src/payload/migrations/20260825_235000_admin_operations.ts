import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads" ADD COLUMN "admin_reviewed_at" timestamp(3) with time zone;
    ALTER TABLE "leads" ADD COLUMN "admin_reviewed_by_id" integer;
    ALTER TABLE "leads" ADD CONSTRAINT "leads_admin_reviewed_by_id_users_id_fk" FOREIGN KEY ("admin_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "leads_admin_reviewed_at_idx" ON "leads" USING btree ("admin_reviewed_at");
    CREATE INDEX "leads_admin_reviewed_by_idx" ON "leads" USING btree ("admin_reviewed_by_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "leads_admin_reviewed_by_idx";
    DROP INDEX "leads_admin_reviewed_at_idx";
    ALTER TABLE "leads" DROP CONSTRAINT "leads_admin_reviewed_by_id_users_id_fk";
    ALTER TABLE "leads" DROP COLUMN "admin_reviewed_by_id";
    ALTER TABLE "leads" DROP COLUMN "admin_reviewed_at";
  `);
}
