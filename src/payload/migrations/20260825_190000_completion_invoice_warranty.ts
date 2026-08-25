import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_invoice_records_status" AS ENUM('draft', 'approved', 'exported', 'sent', 'paid', 'overdue', 'cancelled');
    CREATE TYPE "public"."enum_warranties_status" AS ENUM('active', 'expired', 'revoked');
    ALTER TYPE "public"."enum_private_media_classification" ADD VALUE IF NOT EXISTS 'invoice';
    ALTER TYPE "public"."enum_private_media_classification" ADD VALUE IF NOT EXISTS 'warranty';

    ALTER TABLE "work_orders" ADD COLUMN "completion_reviewed_by_id" integer;
    ALTER TABLE "work_orders" ADD COLUMN "completion_reviewed_at" timestamp(3) with time zone;
    ALTER TABLE "work_orders" ADD COLUMN "completion_review_note" varchar;

    CREATE TABLE "invoice_records" (
      "id" serial PRIMARY KEY NOT NULL,
      "reference" varchar NOT NULL,
      "lead_id" integer NOT NULL,
      "work_order_id" integer NOT NULL,
      "status" "enum_invoice_records_status" DEFAULT 'draft' NOT NULL,
      "snapshot" jsonb NOT NULL,
      "document_hash" varchar NOT NULL,
      "subtotal_ex_vat_ore" numeric NOT NULL,
      "vat_ore" numeric NOT NULL,
      "total_inc_vat_ore" numeric NOT NULL,
      "issued_at" timestamp(3) with time zone NOT NULL,
      "due_at" timestamp(3) with time zone NOT NULL,
      "assigned_to_id" integer NOT NULL,
      "external_reference" varchar,
      "admin_note" varchar,
      "document_id" integer,
      "approved_at" timestamp(3) with time zone,
      "sent_at" timestamp(3) with time zone,
      "paid_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "warranties" (
      "id" serial PRIMARY KEY NOT NULL,
      "reference" varchar NOT NULL,
      "lead_id" integer NOT NULL,
      "work_order_id" integer NOT NULL,
      "status" "enum_warranties_status" DEFAULT 'active' NOT NULL,
      "scope" varchar NOT NULL,
      "starts_at" timestamp(3) with time zone NOT NULL,
      "ends_at" timestamp(3) with time zone NOT NULL,
      "terms_version" varchar NOT NULL,
      "snapshot" jsonb NOT NULL,
      "document_hash" varchar NOT NULL,
      "document_id" integer,
      "approved_by_id" integer NOT NULL,
      "approved_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_completion_reviewed_by_id_users_id_fk" FOREIGN KEY ("completion_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "invoice_records" ADD CONSTRAINT "invoice_records_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "invoice_records" ADD CONSTRAINT "invoice_records_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "invoice_records" ADD CONSTRAINT "invoice_records_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "invoice_records" ADD CONSTRAINT "invoice_records_document_id_private_media_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."private_media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "warranties" ADD CONSTRAINT "warranties_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "warranties" ADD CONSTRAINT "warranties_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "warranties" ADD CONSTRAINT "warranties_document_id_private_media_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."private_media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "warranties" ADD CONSTRAINT "warranties_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;

    CREATE UNIQUE INDEX "invoice_records_reference_idx" ON "invoice_records" USING btree ("reference");
    CREATE INDEX "invoice_records_lead_idx" ON "invoice_records" USING btree ("lead_id");
    CREATE UNIQUE INDEX "invoice_records_work_order_idx" ON "invoice_records" USING btree ("work_order_id");
    CREATE INDEX "invoice_records_status_idx" ON "invoice_records" USING btree ("status");
    CREATE INDEX "invoice_records_document_hash_idx" ON "invoice_records" USING btree ("document_hash");
    CREATE INDEX "invoice_records_due_at_idx" ON "invoice_records" USING btree ("due_at");
    CREATE INDEX "invoice_records_assigned_to_idx" ON "invoice_records" USING btree ("assigned_to_id");
    CREATE INDEX "invoice_records_document_idx" ON "invoice_records" USING btree ("document_id");
    CREATE INDEX "invoice_records_updated_at_idx" ON "invoice_records" USING btree ("updated_at");
    CREATE INDEX "invoice_records_created_at_idx" ON "invoice_records" USING btree ("created_at");
    CREATE UNIQUE INDEX "warranties_reference_idx" ON "warranties" USING btree ("reference");
    CREATE INDEX "warranties_lead_idx" ON "warranties" USING btree ("lead_id");
    CREATE UNIQUE INDEX "warranties_work_order_idx" ON "warranties" USING btree ("work_order_id");
    CREATE INDEX "warranties_status_idx" ON "warranties" USING btree ("status");
    CREATE INDEX "warranties_starts_at_idx" ON "warranties" USING btree ("starts_at");
    CREATE INDEX "warranties_ends_at_idx" ON "warranties" USING btree ("ends_at");
    CREATE INDEX "warranties_document_hash_idx" ON "warranties" USING btree ("document_hash");
    CREATE INDEX "warranties_document_idx" ON "warranties" USING btree ("document_id");
    CREATE INDEX "warranties_updated_at_idx" ON "warranties" USING btree ("updated_at");
    CREATE INDEX "warranties_created_at_idx" ON "warranties" USING btree ("created_at");
    CREATE INDEX "work_orders_completion_reviewed_by_idx" ON "work_orders" USING btree ("completion_reviewed_by_id");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invoice_records_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "warranties_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoice_records_fk" FOREIGN KEY ("invoice_records_id") REFERENCES "public"."invoice_records"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_warranties_fk" FOREIGN KEY ("warranties_id") REFERENCES "public"."warranties"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_invoice_records_id_idx" ON "payload_locked_documents_rels" USING btree ("invoice_records_id");
    CREATE INDEX "payload_locked_documents_rels_warranties_id_idx" ON "payload_locked_documents_rels" USING btree ("warranties_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invoice_records_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_warranties_fk";
    DROP INDEX "payload_locked_documents_rels_invoice_records_id_idx";
    DROP INDEX "payload_locked_documents_rels_warranties_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invoice_records_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "warranties_id";
    ALTER TABLE "invoice_records" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "warranties" DISABLE ROW LEVEL SECURITY;
    DROP TABLE "invoice_records" CASCADE;
    DROP TABLE "warranties" CASCADE;
    DROP INDEX "work_orders_completion_reviewed_by_idx";
    ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_completion_reviewed_by_id_users_id_fk";
    ALTER TABLE "work_orders" DROP COLUMN "completion_reviewed_by_id";
    ALTER TABLE "work_orders" DROP COLUMN "completion_reviewed_at";
    ALTER TABLE "work_orders" DROP COLUMN "completion_review_note";
    DROP TYPE "public"."enum_invoice_records_status";
    DROP TYPE "public"."enum_warranties_status";
  `);
}
