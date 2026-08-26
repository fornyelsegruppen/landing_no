import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_work_orders_status" AS ENUM('unassigned', 'assigned', 'scheduled');
  CREATE TABLE "work_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"lead_id" integer,
  	"assigned_worker_id" integer,
  	"scheduled_at" timestamp(3) with time zone,
  	"status" "enum_work_orders_status" DEFAULT 'unassigned' NOT NULL,
  	"work_summary" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "display_name" varchar;
  ALTER TABLE "users" ADD COLUMN "phone" varchar;
  ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin'::text;
  DELETE FROM "users_sessions"
    WHERE "_parent_id" IN (SELECT "id" FROM "users" WHERE "role" = 'editor');
  UPDATE "users" SET "role" = 'worker', "active" = false WHERE "role" = 'editor';
  DROP TYPE IF EXISTS "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'worker');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "work_orders_id" integer;
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_worker_id_users_id_fk" FOREIGN KEY ("assigned_worker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "work_orders_reference_idx" ON "work_orders" USING btree ("reference");
  CREATE INDEX "work_orders_lead_idx" ON "work_orders" USING btree ("lead_id");
  CREATE INDEX "work_orders_assigned_worker_idx" ON "work_orders" USING btree ("assigned_worker_id");
  CREATE INDEX "work_orders_scheduled_at_idx" ON "work_orders" USING btree ("scheduled_at");
  CREATE INDEX "work_orders_status_idx" ON "work_orders" USING btree ("status");
  CREATE INDEX "work_orders_updated_at_idx" ON "work_orders" USING btree ("updated_at");
  CREATE INDEX "work_orders_created_at_idx" ON "work_orders" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_work_orders_fk" FOREIGN KEY ("work_orders_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_work_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("work_orders_id");`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_work_orders_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_work_orders_id_idx";
  ALTER TABLE "work_orders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "work_orders" CASCADE;
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin'::text;
  UPDATE "users" SET "role" = 'editor' WHERE "role" = 'worker';
  DROP TYPE IF EXISTS "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  ALTER TABLE "users" DROP COLUMN "display_name";
  ALTER TABLE "users" DROP COLUMN "phone";
  ALTER TABLE "users" DROP COLUMN "active";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "work_orders_id";
  DROP TYPE "public"."enum_work_orders_status";`);
}
