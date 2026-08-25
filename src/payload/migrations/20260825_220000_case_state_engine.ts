import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_leads_next_action_owner" AS ENUM('administrator', 'customer', 'system', 'worker');
    ALTER TABLE "leads" ADD COLUMN "next_action_owner" "enum_leads_next_action_owner" DEFAULT 'administrator' NOT NULL;
    ALTER TABLE "leads" ADD COLUMN "next_action_blocker" varchar;
    ALTER TABLE "leads" ADD COLUMN "case_revision" numeric DEFAULT 1 NOT NULL;
    CREATE INDEX "leads_next_action_owner_idx" ON "leads" USING btree ("next_action_owner");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "leads_next_action_owner_idx";
    ALTER TABLE "leads" DROP COLUMN "next_action_owner";
    ALTER TABLE "leads" DROP COLUMN "next_action_blocker";
    ALTER TABLE "leads" DROP COLUMN "case_revision";
    DROP TYPE "public"."enum_leads_next_action_owner";
  `);
}
