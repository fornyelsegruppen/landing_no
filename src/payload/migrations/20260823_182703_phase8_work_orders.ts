import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_work_orders_roof_type" AS ENUM('betongstein', 'teglstein', 'metall', 'skifer', 'shingel', 'annet');
  CREATE TYPE "public"."enum_work_orders_measurement_method" AS ENUM('laser', 'målebånd', 'tegning', 'kart_kontrollert', 'annet');
  CREATE TYPE "public"."enum_work_orders_safety_status" AS ENUM('safe', 'blocked');
  CREATE TYPE "public"."enum_work_orders_precheck_decision" AS ENUM('ready', 'blocked');
  CREATE TYPE "public"."enum_work_orders_price_outcome" AS ENUM('lower', 'within_contract', 'over_tolerance', 'over_maximum', 'scope_change', 'hms_blocked');
  ALTER TYPE "public"."enum_work_orders_status" ADD VALUE 'on_way';
  ALTER TYPE "public"."enum_work_orders_status" ADD VALUE 'arrived';
  ALTER TYPE "public"."enum_work_orders_status" ADD VALUE 'precheck';
  ALTER TYPE "public"."enum_work_orders_status" ADD VALUE 'ready';
  ALTER TYPE "public"."enum_work_orders_status" ADD VALUE 'blocked';
  ALTER TYPE "public"."enum_work_orders_status" ADD VALUE 'in_progress';
  ALTER TYPE "public"."enum_work_orders_status" ADD VALUE 'completed';
  ALTER TYPE "public"."enum_work_orders_status" ADD VALUE 'documented';
  ALTER TYPE "public"."enum_work_orders_status" ADD VALUE 'cancelled';
  CREATE TABLE "work_orders_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"private_media_id" integer
  );
  
  ALTER TABLE "work_orders" ADD COLUMN "quote_id" integer;
  ALTER TABLE "work_orders" ADD COLUMN "contract_id" integer;
  ALTER TABLE "work_orders" ADD COLUMN "contract_document_hash" varchar;
  ALTER TABLE "work_orders" ADD COLUMN "roof_type" "enum_work_orders_roof_type";
  ALTER TABLE "work_orders" ADD COLUMN "actual_area_tenths" numeric;
  ALTER TABLE "work_orders" ADD COLUMN "measurement_method" "enum_work_orders_measurement_method";
  ALTER TABLE "work_orders" ADD COLUMN "slope_basis" varchar;
  ALTER TABLE "work_orders" ADD COLUMN "visible_condition" varchar;
  ALTER TABLE "work_orders" ADD COLUMN "safety_status" "enum_work_orders_safety_status";
  ALTER TABLE "work_orders" ADD COLUMN "safety_notes" varchar;
  ALTER TABLE "work_orders" ADD COLUMN "scope_changed" boolean DEFAULT false;
  ALTER TABLE "work_orders" ADD COLUMN "scope_change_details" varchar;
  ALTER TABLE "work_orders" ADD COLUMN "precheck_decision" "enum_work_orders_precheck_decision";
  ALTER TABLE "work_orders" ADD COLUMN "price_outcome" "enum_work_orders_price_outcome";
  ALTER TABLE "work_orders" ADD COLUMN "allowed_area_max_tenths" numeric;
  ALTER TABLE "work_orders" ADD COLUMN "actual_subtotal_ex_vat_ore" numeric;
  ALTER TABLE "work_orders" ADD COLUMN "actual_vat_ore" numeric;
  ALTER TABLE "work_orders" ADD COLUMN "actual_total_inc_vat_ore" numeric;
  ALTER TABLE "work_orders" ADD COLUMN "blocking_reasons" jsonb;
  ALTER TABLE "work_orders" ADD COLUMN "precheck_completed_at" timestamp(3) with time zone;
  ALTER TABLE "work_orders" ADD COLUMN "started_at" timestamp(3) with time zone;
  ALTER TABLE "work_orders" ADD COLUMN "completion_notes" varchar;
  ALTER TABLE "work_orders" ADD COLUMN "completed_at" timestamp(3) with time zone;
  ALTER TABLE "work_orders" ADD COLUMN "documentation_submitted_at" timestamp(3) with time zone;
  ALTER TABLE "work_orders" ADD COLUMN "event_timeline" jsonb;
  ALTER TABLE "work_orders_rels" ADD CONSTRAINT "work_orders_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "work_orders_rels" ADD CONSTRAINT "work_orders_rels_private_media_fk" FOREIGN KEY ("private_media_id") REFERENCES "public"."private_media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "work_orders_rels_order_idx" ON "work_orders_rels" USING btree ("order");
  CREATE INDEX "work_orders_rels_parent_idx" ON "work_orders_rels" USING btree ("parent_id");
  CREATE INDEX "work_orders_rels_path_idx" ON "work_orders_rels" USING btree ("path");
  CREATE INDEX "work_orders_rels_private_media_id_idx" ON "work_orders_rels" USING btree ("private_media_id");
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;
  CREATE INDEX "work_orders_quote_idx" ON "work_orders" USING btree ("quote_id");
  CREATE UNIQUE INDEX "work_orders_contract_idx" ON "work_orders" USING btree ("contract_id");
  CREATE INDEX "work_orders_contract_document_hash_idx" ON "work_orders" USING btree ("contract_document_hash");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "work_orders_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "work_orders_rels" CASCADE;
  ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_quote_id_quotes_id_fk";
  
  ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_contract_id_contracts_id_fk";
  
  UPDATE "work_orders" SET "status" = 'unassigned' WHERE "status"::text = 'cancelled';
  UPDATE "work_orders" SET "status" = 'scheduled' WHERE "status"::text NOT IN ('unassigned', 'assigned', 'scheduled');
  ALTER TABLE "work_orders" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'unassigned'::text;
  DROP TYPE "public"."enum_work_orders_status";
  CREATE TYPE "public"."enum_work_orders_status" AS ENUM('unassigned', 'assigned', 'scheduled');
  ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'unassigned'::"public"."enum_work_orders_status";
  ALTER TABLE "work_orders" ALTER COLUMN "status" SET DATA TYPE "public"."enum_work_orders_status" USING "status"::"public"."enum_work_orders_status";
  DROP INDEX "work_orders_quote_idx";
  DROP INDEX "work_orders_contract_idx";
  DROP INDEX "work_orders_contract_document_hash_idx";
  ALTER TABLE "work_orders" DROP COLUMN "quote_id";
  ALTER TABLE "work_orders" DROP COLUMN "contract_id";
  ALTER TABLE "work_orders" DROP COLUMN "contract_document_hash";
  ALTER TABLE "work_orders" DROP COLUMN "roof_type";
  ALTER TABLE "work_orders" DROP COLUMN "actual_area_tenths";
  ALTER TABLE "work_orders" DROP COLUMN "measurement_method";
  ALTER TABLE "work_orders" DROP COLUMN "slope_basis";
  ALTER TABLE "work_orders" DROP COLUMN "visible_condition";
  ALTER TABLE "work_orders" DROP COLUMN "safety_status";
  ALTER TABLE "work_orders" DROP COLUMN "safety_notes";
  ALTER TABLE "work_orders" DROP COLUMN "scope_changed";
  ALTER TABLE "work_orders" DROP COLUMN "scope_change_details";
  ALTER TABLE "work_orders" DROP COLUMN "precheck_decision";
  ALTER TABLE "work_orders" DROP COLUMN "price_outcome";
  ALTER TABLE "work_orders" DROP COLUMN "allowed_area_max_tenths";
  ALTER TABLE "work_orders" DROP COLUMN "actual_subtotal_ex_vat_ore";
  ALTER TABLE "work_orders" DROP COLUMN "actual_vat_ore";
  ALTER TABLE "work_orders" DROP COLUMN "actual_total_inc_vat_ore";
  ALTER TABLE "work_orders" DROP COLUMN "blocking_reasons";
  ALTER TABLE "work_orders" DROP COLUMN "precheck_completed_at";
  ALTER TABLE "work_orders" DROP COLUMN "started_at";
  ALTER TABLE "work_orders" DROP COLUMN "completion_notes";
  ALTER TABLE "work_orders" DROP COLUMN "completed_at";
  ALTER TABLE "work_orders" DROP COLUMN "documentation_submitted_at";
  ALTER TABLE "work_orders" DROP COLUMN "event_timeline";
  DROP TYPE "public"."enum_work_orders_roof_type";
  DROP TYPE "public"."enum_work_orders_measurement_method";
  DROP TYPE "public"."enum_work_orders_safety_status";
  DROP TYPE "public"."enum_work_orders_precheck_decision";
  DROP TYPE "public"."enum_work_orders_price_outcome";`)
}
