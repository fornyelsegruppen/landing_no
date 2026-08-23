import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_leads_preferred_channel" AS ENUM('email', 'sms');
  CREATE TYPE "public"."enum_change_agreements_reason_code" AS ENUM('over_tolerance', 'over_maximum', 'scope_change');
  CREATE TYPE "public"."enum_change_agreements_status" AS ENUM('draft', 'approved', 'sent', 'viewed', 'accepted', 'declined', 'revoked', 'superseded');
  ALTER TYPE "public"."enum_messages_category" ADD VALUE 'change_agreement' BEFORE 'reminder';
  ALTER TYPE "public"."enum_messages_category" ADD VALUE 'change_confirmation' BEFORE 'reminder';
  ALTER TYPE "public"."enum_messages_category" ADD VALUE 'measurement_confirmation' BEFORE 'reminder';
  ALTER TYPE "public"."enum_messages_category" ADD VALUE 'schedule_confirmation' BEFORE 'reminder';
  ALTER TYPE "public"."enum_messages_category" ADD VALUE 'completion' BEFORE 'reminder';
  CREATE TABLE "change_agreements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"work_order_id" integer NOT NULL,
  	"contract_id" integer NOT NULL,
  	"version" numeric NOT NULL,
  	"supersedes_id" integer,
  	"snapshot" jsonb NOT NULL,
  	"document_hash" varchar NOT NULL,
  	"reason_code" "enum_change_agreements_reason_code" NOT NULL,
  	"reason_description" varchar NOT NULL,
  	"before_total_inc_vat_ore" numeric NOT NULL,
  	"after_total_inc_vat_ore" numeric NOT NULL,
  	"valid_until" timestamp(3) with time zone NOT NULL,
  	"status" "enum_change_agreements_status" DEFAULT 'draft' NOT NULL,
  	"approved_by_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"viewed_at" timestamp(3) with time zone,
  	"acceptance_evidence" jsonb,
  	"accepted_document_id" integer,
  	"accepted_at" timestamp(3) with time zone,
  	"declined_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "leads" ADD COLUMN "preferred_channel" "enum_leads_preferred_channel" DEFAULT 'email';
  ALTER TABLE "work_orders" ADD COLUMN "approved_change_agreement_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "change_agreements_id" integer;
  ALTER TABLE "change_agreements" ADD CONSTRAINT "change_agreements_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "change_agreements" ADD CONSTRAINT "change_agreements_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "change_agreements" ADD CONSTRAINT "change_agreements_supersedes_id_change_agreements_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."change_agreements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "change_agreements" ADD CONSTRAINT "change_agreements_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "change_agreements" ADD CONSTRAINT "change_agreements_accepted_document_id_private_media_id_fk" FOREIGN KEY ("accepted_document_id") REFERENCES "public"."private_media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "change_agreements_reference_idx" ON "change_agreements" USING btree ("reference");
  CREATE INDEX "change_agreements_work_order_idx" ON "change_agreements" USING btree ("work_order_id");
  CREATE INDEX "change_agreements_contract_idx" ON "change_agreements" USING btree ("contract_id");
  CREATE INDEX "change_agreements_supersedes_idx" ON "change_agreements" USING btree ("supersedes_id");
  CREATE INDEX "change_agreements_document_hash_idx" ON "change_agreements" USING btree ("document_hash");
  CREATE INDEX "change_agreements_valid_until_idx" ON "change_agreements" USING btree ("valid_until");
  CREATE INDEX "change_agreements_status_idx" ON "change_agreements" USING btree ("status");
  CREATE INDEX "change_agreements_approved_by_idx" ON "change_agreements" USING btree ("approved_by_id");
  CREATE INDEX "change_agreements_accepted_document_idx" ON "change_agreements" USING btree ("accepted_document_id");
  CREATE INDEX "change_agreements_updated_at_idx" ON "change_agreements" USING btree ("updated_at");
  CREATE INDEX "change_agreements_created_at_idx" ON "change_agreements" USING btree ("created_at");
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_approved_change_agreement_id_change_agreements_id_fk" FOREIGN KEY ("approved_change_agreement_id") REFERENCES "public"."change_agreements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_change_agreements_fk" FOREIGN KEY ("change_agreements_id") REFERENCES "public"."change_agreements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "work_orders_approved_change_agreement_idx" ON "work_orders" USING btree ("approved_change_agreement_id");
  CREATE INDEX "payload_locked_documents_rels_change_agreements_id_idx" ON "payload_locked_documents_rels" USING btree ("change_agreements_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  	ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_approved_change_agreement_id_change_agreements_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_change_agreements_fk";

  DROP INDEX "work_orders_approved_change_agreement_idx";
  DROP INDEX "payload_locked_documents_rels_change_agreements_id_idx";
  ALTER TABLE "work_orders" DROP COLUMN "approved_change_agreement_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "change_agreements_id";
  ALTER TABLE "change_agreements" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "change_agreements";

  UPDATE "messages" SET "category" = 'follow_up' WHERE "category" IN ('change_agreement', 'change_confirmation', 'measurement_confirmation');
  UPDATE "messages" SET "category" = 'reminder' WHERE "category" IN ('schedule_confirmation', 'completion');
  ALTER TABLE "messages" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_messages_category";
  CREATE TYPE "public"."enum_messages_category" AS ENUM('receipt', 'ai_reply', 'information_request', 'follow_up', 'quote', 'contract', 'customer_question', 'reminder');
  ALTER TABLE "messages" ALTER COLUMN "category" SET DATA TYPE "public"."enum_messages_category" USING "category"::"public"."enum_messages_category";
  ALTER TABLE "leads" DROP COLUMN "preferred_channel";
  DROP TYPE "public"."enum_leads_preferred_channel";
  DROP TYPE "public"."enum_change_agreements_reason_code";
  DROP TYPE "public"."enum_change_agreements_status";`)
}
