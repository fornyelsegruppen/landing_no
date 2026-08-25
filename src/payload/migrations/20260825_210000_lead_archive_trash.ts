import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_leads_record_state" AS ENUM('active', 'archived', 'trashed');
    CREATE TYPE "public"."enum_leads_archive_classification" AS ENUM('completed', 'declined', 'lost', 'invalid', 'spam', 'duplicate', 'other');
    ALTER TABLE "leads" ADD COLUMN "record_state" "enum_leads_record_state" DEFAULT 'active' NOT NULL;
    ALTER TABLE "leads" ADD COLUMN "archive_classification" "enum_leads_archive_classification";
    ALTER TABLE "leads" ADD COLUMN "archive_reason" varchar;
    ALTER TABLE "leads" ADD COLUMN "archived_at" timestamp(3) with time zone;
    ALTER TABLE "leads" ADD COLUMN "archived_by_id" integer;
    ALTER TABLE "leads" ADD COLUMN "trashed_at" timestamp(3) with time zone;
    ALTER TABLE "leads" ADD COLUMN "trashed_by_id" integer;
    ALTER TABLE "leads" ADD COLUMN "purge_after" timestamp(3) with time zone;
    ALTER TABLE "leads" ADD CONSTRAINT "leads_archived_by_id_users_id_fk" FOREIGN KEY ("archived_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "leads" ADD CONSTRAINT "leads_trashed_by_id_users_id_fk" FOREIGN KEY ("trashed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "leads_record_state_idx" ON "leads" USING btree ("record_state");
    CREATE INDEX "leads_archive_classification_idx" ON "leads" USING btree ("archive_classification");
    CREATE INDEX "leads_archived_at_idx" ON "leads" USING btree ("archived_at");
    CREATE INDEX "leads_archived_by_idx" ON "leads" USING btree ("archived_by_id");
    CREATE INDEX "leads_trashed_at_idx" ON "leads" USING btree ("trashed_at");
    CREATE INDEX "leads_trashed_by_idx" ON "leads" USING btree ("trashed_by_id");
    CREATE INDEX "leads_purge_after_idx" ON "leads" USING btree ("purge_after");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "leads_record_state_idx";
    DROP INDEX "leads_archive_classification_idx";
    DROP INDEX "leads_archived_at_idx";
    DROP INDEX "leads_archived_by_idx";
    DROP INDEX "leads_trashed_at_idx";
    DROP INDEX "leads_trashed_by_idx";
    DROP INDEX "leads_purge_after_idx";
    ALTER TABLE "leads" DROP CONSTRAINT "leads_archived_by_id_users_id_fk";
    ALTER TABLE "leads" DROP CONSTRAINT "leads_trashed_by_id_users_id_fk";
    ALTER TABLE "leads" DROP COLUMN "record_state";
    ALTER TABLE "leads" DROP COLUMN "archive_classification";
    ALTER TABLE "leads" DROP COLUMN "archive_reason";
    ALTER TABLE "leads" DROP COLUMN "archived_at";
    ALTER TABLE "leads" DROP COLUMN "archived_by_id";
    ALTER TABLE "leads" DROP COLUMN "trashed_at";
    ALTER TABLE "leads" DROP COLUMN "trashed_by_id";
    ALTER TABLE "leads" DROP COLUMN "purge_after";
    DROP TYPE "public"."enum_leads_record_state";
    DROP TYPE "public"."enum_leads_archive_classification";
  `);
}
