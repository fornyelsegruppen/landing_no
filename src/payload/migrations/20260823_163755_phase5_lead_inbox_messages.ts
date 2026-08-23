import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_messages_direction" AS ENUM('outbound', 'inbound');
  CREATE TYPE "public"."enum_messages_category" AS ENUM('receipt', 'ai_reply', 'information_request', 'follow_up', 'quote', 'contract', 'reminder');
  CREATE TYPE "public"."enum_messages_channel" AS ENUM('email', 'sms');
  CREATE TYPE "public"."enum_messages_status" AS ENUM('draft', 'approved', 'queued', 'sent', 'delivered', 'failed', 'attention', 'cancelled');
  CREATE TABLE "messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lead_id" integer,
  	"direction" "enum_messages_direction" DEFAULT 'outbound' NOT NULL,
  	"category" "enum_messages_category" NOT NULL,
  	"channel" "enum_messages_channel" NOT NULL,
  	"subject" varchar NOT NULL,
  	"body_text" varchar NOT NULL,
  	"body_html" varchar,
  	"status" "enum_messages_status" DEFAULT 'draft' NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"ai_assisted" boolean DEFAULT false,
  	"ai_analysis" jsonb,
  	"model_version" varchar,
  	"prompt_version" varchar,
  	"approved_by_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"queued_at" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"provider" varchar,
  	"provider_message_id" varchar,
  	"failure_code" varchar,
  	"failure_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new'::text;
  DROP TYPE "public"."enum_leads_status";
  CREATE TYPE "public"."enum_leads_status" AS ENUM('new', 'draft_ready', 'waiting_customer', 'qualified', 'measuring', 'quoted', 'converted', 'closed', 'contacted');
  ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new'::"public"."enum_leads_status";
  ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE "public"."enum_leads_status" USING "status"::"public"."enum_leads_status";
  ALTER TABLE "leads" ADD COLUMN "assigned_to_id" integer;
  ALTER TABLE "leads" ADD COLUMN "next_action" varchar;
  ALTER TABLE "leads" ADD COLUMN "next_action_at" timestamp(3) with time zone;
  ALTER TABLE "leads" ADD COLUMN "last_contact_at" timestamp(3) with time zone;
  ALTER TABLE "leads" ADD COLUMN "closed_at" timestamp(3) with time zone;
  ALTER TABLE "leads" ADD COLUMN "qualification" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "messages_id" integer;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "messages_lead_idx" ON "messages" USING btree ("lead_id");
  CREATE INDEX "messages_category_idx" ON "messages" USING btree ("category");
  CREATE INDEX "messages_status_idx" ON "messages" USING btree ("status");
  CREATE UNIQUE INDEX "messages_idempotency_key_idx" ON "messages" USING btree ("idempotency_key");
  CREATE INDEX "messages_approved_by_idx" ON "messages" USING btree ("approved_by_id");
  CREATE INDEX "messages_updated_at_idx" ON "messages" USING btree ("updated_at");
  CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");
  ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_messages_fk" FOREIGN KEY ("messages_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "leads_assigned_to_idx" ON "leads" USING btree ("assigned_to_id");
  CREATE INDEX "leads_next_action_at_idx" ON "leads" USING btree ("next_action_at");
  CREATE INDEX "payload_locked_documents_rels_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("messages_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_messages_fk";
  ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "messages" CASCADE;
  ALTER TABLE "leads" DROP CONSTRAINT "leads_assigned_to_id_users_id_fk";
  UPDATE "leads" SET "status" = 'contacted' WHERE "status" IN ('draft_ready', 'waiting_customer');
  UPDATE "leads" SET "status" = 'qualified' WHERE "status" IN ('measuring', 'quoted', 'converted');
  ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new'::text;
  DROP TYPE "public"."enum_leads_status";
  CREATE TYPE "public"."enum_leads_status" AS ENUM('new', 'contacted', 'qualified', 'closed');
  ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new'::"public"."enum_leads_status";
  ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE "public"."enum_leads_status" USING "status"::"public"."enum_leads_status";
  DROP INDEX "leads_assigned_to_idx";
  DROP INDEX "leads_next_action_at_idx";
  DROP INDEX "payload_locked_documents_rels_messages_id_idx";
  ALTER TABLE "leads" DROP COLUMN "assigned_to_id";
  ALTER TABLE "leads" DROP COLUMN "next_action";
  ALTER TABLE "leads" DROP COLUMN "next_action_at";
  ALTER TABLE "leads" DROP COLUMN "last_contact_at";
  ALTER TABLE "leads" DROP COLUMN "closed_at";
  ALTER TABLE "leads" DROP COLUMN "qualification";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "messages_id";
  DROP TYPE "public"."enum_messages_direction";
  DROP TYPE "public"."enum_messages_category";
  DROP TYPE "public"."enum_messages_channel";
  DROP TYPE "public"."enum_messages_status";`)
}
