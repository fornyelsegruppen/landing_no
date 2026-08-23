import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_quotes_status" AS ENUM('draft', 'approved', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'revoked', 'superseded');
  CREATE TYPE "public"."enum_contracts_status" AS ENUM('draft', 'issued', 'signed', 'declined', 'revoked', 'superseded');
  CREATE TYPE "public"."enum_contract_terms_status" AS ENUM('draft', 'approved', 'retired');
  CREATE TABLE "quotes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"lead_id" integer NOT NULL,
  	"measurement_id" integer NOT NULL,
  	"price_calculation_id" integer NOT NULL,
  	"version" numeric NOT NULL,
  	"supersedes_id" integer,
  	"snapshot" jsonb NOT NULL,
  	"snapshot_hash" varchar NOT NULL,
  	"service_description" varchar NOT NULL,
  	"total_inc_vat_ore" numeric NOT NULL,
  	"maximum_total_inc_vat_ore" numeric,
  	"terms_version" varchar NOT NULL,
  	"valid_until" timestamp(3) with time zone NOT NULL,
  	"status" "enum_quotes_status" DEFAULT 'draft' NOT NULL,
  	"approved_by_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"viewed_at" timestamp(3) with time zone,
  	"accepted_at" timestamp(3) with time zone,
  	"declined_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "contracts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"quote_id" integer NOT NULL,
  	"version" numeric NOT NULL,
  	"supersedes_id" integer,
  	"snapshot" jsonb NOT NULL,
  	"document_hash" varchar NOT NULL,
  	"terms_version" varchar NOT NULL,
  	"status" "enum_contracts_status" DEFAULT 'draft' NOT NULL,
  	"signature_evidence" jsonb,
  	"signed_document_id" integer,
  	"signed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "contract_terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"contract_text" varchar NOT NULL,
  	"withdrawal_instructions" varchar NOT NULL,
  	"withdrawal_form_url" varchar NOT NULL,
  	"status" "enum_contract_terms_status" DEFAULT 'draft' NOT NULL,
  	"legal_review_reference" varchar,
  	"approved_by_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quotes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contracts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contract_terms_id" integer;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_measurement_id_roof_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."roof_measurements"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_price_calculation_id_price_calculations_id_fk" FOREIGN KEY ("price_calculation_id") REFERENCES "public"."price_calculations"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_supersedes_id_quotes_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supersedes_id_contracts_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_signed_document_id_private_media_id_fk" FOREIGN KEY ("signed_document_id") REFERENCES "public"."private_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contract_terms" ADD CONSTRAINT "contract_terms_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "quotes_reference_idx" ON "quotes" USING btree ("reference");
  CREATE INDEX "quotes_lead_idx" ON "quotes" USING btree ("lead_id");
  CREATE INDEX "quotes_measurement_idx" ON "quotes" USING btree ("measurement_id");
  CREATE INDEX "quotes_price_calculation_idx" ON "quotes" USING btree ("price_calculation_id");
  CREATE INDEX "quotes_supersedes_idx" ON "quotes" USING btree ("supersedes_id");
  CREATE INDEX "quotes_snapshot_hash_idx" ON "quotes" USING btree ("snapshot_hash");
  CREATE INDEX "quotes_valid_until_idx" ON "quotes" USING btree ("valid_until");
  CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");
  CREATE INDEX "quotes_approved_by_idx" ON "quotes" USING btree ("approved_by_id");
  CREATE INDEX "quotes_updated_at_idx" ON "quotes" USING btree ("updated_at");
  CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");
  CREATE UNIQUE INDEX "contracts_reference_idx" ON "contracts" USING btree ("reference");
  CREATE INDEX "contracts_quote_idx" ON "contracts" USING btree ("quote_id");
  CREATE INDEX "contracts_supersedes_idx" ON "contracts" USING btree ("supersedes_id");
  CREATE INDEX "contracts_document_hash_idx" ON "contracts" USING btree ("document_hash");
  CREATE INDEX "contracts_status_idx" ON "contracts" USING btree ("status");
  CREATE INDEX "contracts_signed_document_idx" ON "contracts" USING btree ("signed_document_id");
  CREATE INDEX "contracts_updated_at_idx" ON "contracts" USING btree ("updated_at");
  CREATE INDEX "contracts_created_at_idx" ON "contracts" USING btree ("created_at");
  CREATE UNIQUE INDEX "contract_terms_version_idx" ON "contract_terms" USING btree ("version");
  CREATE INDEX "contract_terms_status_idx" ON "contract_terms" USING btree ("status");
  CREATE INDEX "contract_terms_approved_by_idx" ON "contract_terms" USING btree ("approved_by_id");
  CREATE INDEX "contract_terms_updated_at_idx" ON "contract_terms" USING btree ("updated_at");
  CREATE INDEX "contract_terms_created_at_idx" ON "contract_terms" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quotes_fk" FOREIGN KEY ("quotes_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contracts_fk" FOREIGN KEY ("contracts_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contract_terms_fk" FOREIGN KEY ("contract_terms_id") REFERENCES "public"."contract_terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_quotes_id_idx" ON "payload_locked_documents_rels" USING btree ("quotes_id");
  CREATE INDEX "payload_locked_documents_rels_contracts_id_idx" ON "payload_locked_documents_rels" USING btree ("contracts_id");
  CREATE INDEX "payload_locked_documents_rels_contract_terms_id_idx" ON "payload_locked_documents_rels" USING btree ("contract_terms_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quotes_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contracts_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contract_terms_fk";
  DROP INDEX "payload_locked_documents_rels_quotes_id_idx";
  DROP INDEX "payload_locked_documents_rels_contracts_id_idx";
  DROP INDEX "payload_locked_documents_rels_contract_terms_id_idx";
  ALTER TABLE "quotes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contracts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contract_terms" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "contracts" CASCADE;
  DROP TABLE "quotes" CASCADE;
  DROP TABLE "contract_terms" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quotes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contracts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contract_terms_id";
  DROP TYPE "public"."enum_quotes_status";
  DROP TYPE "public"."enum_contracts_status";
  DROP TYPE "public"."enum_contract_terms_status";`)
}
