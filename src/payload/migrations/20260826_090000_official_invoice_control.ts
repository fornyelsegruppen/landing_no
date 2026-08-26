import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_official_invoices_status" AS ENUM('needs_review', 'issued', 'sent', 'awaiting_payment', 'paid', 'overdue', 'credited', 'cancelled');
    CREATE TYPE "public"."enum_official_invoices_extraction_status" AS ENUM('needs_review', 'confirmed', 'failed');

    CREATE TABLE "official_invoices" (
      "id" serial PRIMARY KEY NOT NULL,
      "reference" varchar NOT NULL,
      "lead_id" integer NOT NULL,
      "work_order_id" integer NOT NULL,
      "invoice_record_id" integer NOT NULL,
      "status" "enum_official_invoices_status" DEFAULT 'needs_review' NOT NULL,
      "original_document_id" integer NOT NULL,
      "original_hash" varchar NOT NULL,
      "extraction_status" "enum_official_invoices_extraction_status" DEFAULT 'needs_review' NOT NULL,
      "extracted_data" jsonb,
      "invoice_number" varchar,
      "issued_at" timestamp(3) with time zone,
      "due_at" timestamp(3) with time zone,
      "subtotal_ex_vat_ore" numeric,
      "vat_ore" numeric,
      "total_inc_vat_ore" numeric,
      "confirmed_by_id" integer,
      "confirmed_at" timestamp(3) with time zone,
      "sent_at" timestamp(3) with time zone,
      "paid_amount_ore" numeric,
      "paid_at" timestamp(3) with time zone,
      "bank_reference" varchar,
      "bank_checked_at" timestamp(3) with time zone,
      "bank_checked_by_id" integer,
      "admin_note" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "official_invoices" ADD CONSTRAINT "official_invoices_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "official_invoices" ADD CONSTRAINT "official_invoices_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "official_invoices" ADD CONSTRAINT "official_invoices_invoice_record_id_invoice_records_id_fk" FOREIGN KEY ("invoice_record_id") REFERENCES "public"."invoice_records"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "official_invoices" ADD CONSTRAINT "official_invoices_original_document_id_private_media_id_fk" FOREIGN KEY ("original_document_id") REFERENCES "public"."private_media"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "official_invoices" ADD CONSTRAINT "official_invoices_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "official_invoices" ADD CONSTRAINT "official_invoices_bank_checked_by_id_users_id_fk" FOREIGN KEY ("bank_checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

    CREATE UNIQUE INDEX "official_invoices_reference_idx" ON "official_invoices" USING btree ("reference");
    CREATE INDEX "official_invoices_lead_idx" ON "official_invoices" USING btree ("lead_id");
    CREATE INDEX "official_invoices_work_order_idx" ON "official_invoices" USING btree ("work_order_id");
    CREATE INDEX "official_invoices_invoice_record_idx" ON "official_invoices" USING btree ("invoice_record_id");
    CREATE INDEX "official_invoices_status_idx" ON "official_invoices" USING btree ("status");
    CREATE INDEX "official_invoices_original_document_idx" ON "official_invoices" USING btree ("original_document_id");
    CREATE UNIQUE INDEX "official_invoices_original_hash_idx" ON "official_invoices" USING btree ("original_hash");
    CREATE INDEX "official_invoices_extraction_status_idx" ON "official_invoices" USING btree ("extraction_status");
    CREATE UNIQUE INDEX "official_invoices_invoice_number_idx" ON "official_invoices" USING btree ("invoice_number");
    CREATE INDEX "official_invoices_due_at_idx" ON "official_invoices" USING btree ("due_at");
    CREATE INDEX "official_invoices_confirmed_by_idx" ON "official_invoices" USING btree ("confirmed_by_id");
    CREATE INDEX "official_invoices_bank_checked_by_idx" ON "official_invoices" USING btree ("bank_checked_by_id");
    CREATE INDEX "official_invoices_updated_at_idx" ON "official_invoices" USING btree ("updated_at");
    CREATE INDEX "official_invoices_created_at_idx" ON "official_invoices" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "official_invoices_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_official_invoices_fk" FOREIGN KEY ("official_invoices_id") REFERENCES "public"."official_invoices"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_official_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("official_invoices_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_official_invoices_fk";
    DROP INDEX "payload_locked_documents_rels_official_invoices_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "official_invoices_id";
    ALTER TABLE "official_invoices" DISABLE ROW LEVEL SECURITY;
    DROP TABLE "official_invoices" CASCADE;
    DROP TYPE "public"."enum_official_invoices_status";
    DROP TYPE "public"."enum_official_invoices_extraction_status";
  `);
}

