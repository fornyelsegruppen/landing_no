import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_roof_measurements_confidence" AS ENUM('high', 'medium', 'low');
  CREATE TYPE "public"."enum_roof_measurements_status" AS ENUM('draft', 'review_required', 'blocked', 'approved', 'superseded');
  CREATE TYPE "public"."enum_price_rules_service_key" AS ENUM('takvask', 'takvask_impregnering', 'impregnering', 'takmaling', 'nytt_tak');
  CREATE TYPE "public"."enum_price_rules_status" AS ENUM('draft', 'approved', 'retired');
  CREATE TYPE "public"."enum_price_calculations_status" AS ENUM('draft', 'ready', 'blocked', 'superseded');
  CREATE TABLE "roof_measurements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"lead_id" integer NOT NULL,
  	"version" numeric NOT NULL,
  	"supersedes_id" integer,
  	"normalized_address" varchar NOT NULL,
  	"address_source_id" varchar,
  	"latitude" numeric NOT NULL,
  	"longitude" numeric NOT NULL,
  	"building_identifier" varchar,
  	"source" varchar DEFAULT 'Kartverket / manuell kontroll' NOT NULL,
  	"source_url" varchar,
  	"license" varchar DEFAULT 'CC BY 4.0 / særvilkår for ortofoto' NOT NULL,
  	"credits" varchar DEFAULT '© Kartverket' NOT NULL,
  	"captured_at" timestamp(3) with time zone NOT NULL,
  	"map_image_id" integer,
  	"roof_planes" jsonb NOT NULL,
  	"horizontal_area_tenths" numeric NOT NULL,
  	"actual_area_min_tenths" numeric NOT NULL,
  	"actual_area_max_tenths" numeric NOT NULL,
  	"calculation_snapshot" jsonb NOT NULL,
  	"input_hash" varchar NOT NULL,
  	"confidence" "enum_roof_measurements_confidence" NOT NULL,
  	"confidence_reasoning" varchar NOT NULL,
  	"status" "enum_roof_measurements_status" DEFAULT 'draft' NOT NULL,
  	"blocking_reasons" jsonb,
  	"approved_by_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "price_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"version" numeric NOT NULL,
  	"service_key" "enum_price_rules_service_key" NOT NULL,
  	"unit_price_ex_vat_ore" numeric NOT NULL,
  	"vat_basis_points" numeric DEFAULT 2500 NOT NULL,
  	"minimum_ex_vat_ore" numeric DEFAULT 0 NOT NULL,
  	"tolerance_basis_points" numeric DEFAULT 0 NOT NULL,
  	"maximum_ex_vat_ore" numeric,
  	"valid_from" timestamp(3) with time zone NOT NULL,
  	"valid_to" timestamp(3) with time zone,
  	"terms_version" varchar NOT NULL,
  	"notes" varchar,
  	"status" "enum_price_rules_status" DEFAULT 'draft' NOT NULL,
  	"approved_by_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "price_calculations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"lead_id" integer NOT NULL,
  	"measurement_id" integer NOT NULL,
  	"price_rule_id" integer NOT NULL,
  	"input_snapshot" jsonb NOT NULL,
  	"output_snapshot" jsonb NOT NULL,
  	"input_hash" varchar NOT NULL,
  	"subtotal_ex_vat_ore" numeric NOT NULL,
  	"vat_ore" numeric NOT NULL,
  	"total_inc_vat_ore" numeric NOT NULL,
  	"maximum_total_inc_vat_ore" numeric,
  	"status" "enum_price_calculations_status" DEFAULT 'draft' NOT NULL,
  	"blocking_reasons" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "messages" ALTER COLUMN "lead_id" DROP NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "roof_measurements_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "price_rules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "price_calculations_id" integer;
  ALTER TABLE "roof_measurements" ADD CONSTRAINT "roof_measurements_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "roof_measurements" ADD CONSTRAINT "roof_measurements_supersedes_id_roof_measurements_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."roof_measurements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roof_measurements" ADD CONSTRAINT "roof_measurements_map_image_id_private_media_id_fk" FOREIGN KEY ("map_image_id") REFERENCES "public"."private_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roof_measurements" ADD CONSTRAINT "roof_measurements_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "price_calculations" ADD CONSTRAINT "price_calculations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "price_calculations" ADD CONSTRAINT "price_calculations_measurement_id_roof_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."roof_measurements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "price_calculations" ADD CONSTRAINT "price_calculations_price_rule_id_price_rules_id_fk" FOREIGN KEY ("price_rule_id") REFERENCES "public"."price_rules"("id") ON DELETE restrict ON UPDATE no action;
  CREATE UNIQUE INDEX "roof_measurements_reference_idx" ON "roof_measurements" USING btree ("reference");
  CREATE INDEX "roof_measurements_lead_idx" ON "roof_measurements" USING btree ("lead_id");
  CREATE INDEX "roof_measurements_version_idx" ON "roof_measurements" USING btree ("version");
  CREATE INDEX "roof_measurements_supersedes_idx" ON "roof_measurements" USING btree ("supersedes_id");
  CREATE INDEX "roof_measurements_map_image_idx" ON "roof_measurements" USING btree ("map_image_id");
  CREATE INDEX "roof_measurements_input_hash_idx" ON "roof_measurements" USING btree ("input_hash");
  CREATE INDEX "roof_measurements_status_idx" ON "roof_measurements" USING btree ("status");
  CREATE INDEX "roof_measurements_approved_by_idx" ON "roof_measurements" USING btree ("approved_by_id");
  CREATE INDEX "roof_measurements_updated_at_idx" ON "roof_measurements" USING btree ("updated_at");
  CREATE INDEX "roof_measurements_created_at_idx" ON "roof_measurements" USING btree ("created_at");
  CREATE UNIQUE INDEX "price_rules_reference_idx" ON "price_rules" USING btree ("reference");
  CREATE INDEX "price_rules_service_key_idx" ON "price_rules" USING btree ("service_key");
  CREATE INDEX "price_rules_valid_from_idx" ON "price_rules" USING btree ("valid_from");
  CREATE INDEX "price_rules_valid_to_idx" ON "price_rules" USING btree ("valid_to");
  CREATE INDEX "price_rules_status_idx" ON "price_rules" USING btree ("status");
  CREATE INDEX "price_rules_approved_by_idx" ON "price_rules" USING btree ("approved_by_id");
  CREATE INDEX "price_rules_updated_at_idx" ON "price_rules" USING btree ("updated_at");
  CREATE INDEX "price_rules_created_at_idx" ON "price_rules" USING btree ("created_at");
  CREATE UNIQUE INDEX "price_calculations_reference_idx" ON "price_calculations" USING btree ("reference");
  CREATE INDEX "price_calculations_lead_idx" ON "price_calculations" USING btree ("lead_id");
  CREATE INDEX "price_calculations_measurement_idx" ON "price_calculations" USING btree ("measurement_id");
  CREATE INDEX "price_calculations_price_rule_idx" ON "price_calculations" USING btree ("price_rule_id");
  CREATE INDEX "price_calculations_input_hash_idx" ON "price_calculations" USING btree ("input_hash");
  CREATE INDEX "price_calculations_updated_at_idx" ON "price_calculations" USING btree ("updated_at");
  CREATE INDEX "price_calculations_created_at_idx" ON "price_calculations" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roof_measurements_fk" FOREIGN KEY ("roof_measurements_id") REFERENCES "public"."roof_measurements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_price_rules_fk" FOREIGN KEY ("price_rules_id") REFERENCES "public"."price_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_price_calculations_fk" FOREIGN KEY ("price_calculations_id") REFERENCES "public"."price_calculations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_roof_measurements_id_idx" ON "payload_locked_documents_rels" USING btree ("roof_measurements_id");
  CREATE INDEX "payload_locked_documents_rels_price_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("price_rules_id");
  CREATE INDEX "payload_locked_documents_rels_price_calculations_id_idx" ON "payload_locked_documents_rels" USING btree ("price_calculations_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_roof_measurements_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_price_rules_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_price_calculations_fk";
  DROP INDEX "payload_locked_documents_rels_roof_measurements_id_idx";
  DROP INDEX "payload_locked_documents_rels_price_rules_id_idx";
  DROP INDEX "payload_locked_documents_rels_price_calculations_id_idx";
  ALTER TABLE "roof_measurements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "price_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "price_calculations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "price_calculations" CASCADE;
  DROP TABLE "roof_measurements" CASCADE;
  DROP TABLE "price_rules" CASCADE;
  DELETE FROM "messages" WHERE "lead_id" IS NULL;
  ALTER TABLE "messages" ALTER COLUMN "lead_id" SET NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "roof_measurements_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "price_rules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "price_calculations_id";
  DROP TYPE "public"."enum_roof_measurements_confidence";
  DROP TYPE "public"."enum_roof_measurements_status";
  DROP TYPE "public"."enum_price_rules_service_key";
  DROP TYPE "public"."enum_price_rules_status";
  DROP TYPE "public"."enum_price_calculations_status";`)
}
