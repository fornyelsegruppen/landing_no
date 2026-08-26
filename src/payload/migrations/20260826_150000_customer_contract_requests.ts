import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_customer_contract_requests_kind" AS ENUM('withdrawal', 'change_or_cancel');
    CREATE TYPE "public"."enum_customer_contract_requests_reason_code" AS ENUM('price', 'wait', 'timing', 'other_supplier', 'scope', 'need_information', 'personal_financial', 'communication', 'not_needed', 'other', 'prefer_not_to_say');
    CREATE TYPE "public"."enum_customer_contract_requests_preferred_follow_up" AS ENUM('one_month', 'three_months', 'six_months', 'next_spring', 'custom', 'never');
    CREATE TYPE "public"."enum_customer_contract_requests_status" AS ENUM('received', 'admin_review', 'alternative_requested', 'follow_up_scheduled', 'recovered', 'closed', 'do_not_contact');
    CREATE TYPE "public"."enum_customer_contract_requests_recovery_potential" AS ENUM('green', 'yellow', 'red');

    CREATE TABLE "customer_contract_requests" (
      "id" serial PRIMARY KEY NOT NULL,
      "reference" varchar NOT NULL,
      "lead_id" integer NOT NULL,
      "quote_id" integer NOT NULL,
      "contract_id" integer NOT NULL,
      "work_order_id" integer,
      "kind" "enum_customer_contract_requests_kind" NOT NULL,
      "reason_code" "enum_customer_contract_requests_reason_code" NOT NULL,
      "reason_text" varchar,
      "follow_up_consent" boolean DEFAULT false NOT NULL,
      "preferred_follow_up" "enum_customer_contract_requests_preferred_follow_up",
      "preferred_follow_up_at" timestamp(3) with time zone,
      "status" "enum_customer_contract_requests_status" DEFAULT 'received' NOT NULL,
      "recovery_potential" "enum_customer_contract_requests_recovery_potential" DEFAULT 'yellow' NOT NULL,
      "received_at" timestamp(3) with time zone NOT NULL,
      "contract_signed_at" timestamp(3) with time zone,
      "company_signed_at" timestamp(3) with time zone,
      "nominal_withdrawal_deadline" timestamp(3) with time zone,
      "within_nominal_withdrawal_period" boolean,
      "early_start_requested" boolean,
      "work_status_at_receipt" varchar,
      "deposit_status_at_receipt" varchar,
      "source_message_id" integer NOT NULL,
      "request_fingerprint" varchar NOT NULL,
      "administrator_decision" varchar,
      "reviewed_by_id" integer,
      "reviewed_at" timestamp(3) with time zone,
      "follow_up_at" timestamp(3) with time zone,
      "follow_up_attempts" numeric DEFAULT 0,
      "follow_up_outcome" varchar,
      "closed_at" timestamp(3) with time zone,
      "ai_summary" varchar,
      "ai_suggested_action" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "customer_contract_requests" ADD CONSTRAINT "customer_contract_requests_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "customer_contract_requests" ADD CONSTRAINT "customer_contract_requests_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "customer_contract_requests" ADD CONSTRAINT "customer_contract_requests_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "customer_contract_requests" ADD CONSTRAINT "customer_contract_requests_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "customer_contract_requests" ADD CONSTRAINT "customer_contract_requests_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "customer_contract_requests" ADD CONSTRAINT "customer_contract_requests_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

    CREATE UNIQUE INDEX "customer_contract_requests_reference_idx" ON "customer_contract_requests" USING btree ("reference");
    CREATE INDEX "customer_contract_requests_lead_idx" ON "customer_contract_requests" USING btree ("lead_id");
    CREATE INDEX "customer_contract_requests_quote_idx" ON "customer_contract_requests" USING btree ("quote_id");
    CREATE INDEX "customer_contract_requests_contract_idx" ON "customer_contract_requests" USING btree ("contract_id");
    CREATE INDEX "customer_contract_requests_work_order_idx" ON "customer_contract_requests" USING btree ("work_order_id");
    CREATE INDEX "customer_contract_requests_kind_idx" ON "customer_contract_requests" USING btree ("kind");
    CREATE INDEX "customer_contract_requests_reason_code_idx" ON "customer_contract_requests" USING btree ("reason_code");
    CREATE INDEX "customer_contract_requests_status_idx" ON "customer_contract_requests" USING btree ("status");
    CREATE INDEX "customer_contract_requests_recovery_potential_idx" ON "customer_contract_requests" USING btree ("recovery_potential");
    CREATE INDEX "customer_contract_requests_received_at_idx" ON "customer_contract_requests" USING btree ("received_at");
    CREATE INDEX "customer_contract_requests_preferred_follow_up_at_idx" ON "customer_contract_requests" USING btree ("preferred_follow_up_at");
    CREATE INDEX "customer_contract_requests_follow_up_at_idx" ON "customer_contract_requests" USING btree ("follow_up_at");
    CREATE INDEX "customer_contract_requests_source_message_idx" ON "customer_contract_requests" USING btree ("source_message_id");
    CREATE UNIQUE INDEX "customer_contract_requests_request_fingerprint_idx" ON "customer_contract_requests" USING btree ("request_fingerprint");
    CREATE INDEX "customer_contract_requests_reviewed_by_idx" ON "customer_contract_requests" USING btree ("reviewed_by_id");
    CREATE INDEX "customer_contract_requests_updated_at_idx" ON "customer_contract_requests" USING btree ("updated_at");
    CREATE INDEX "customer_contract_requests_created_at_idx" ON "customer_contract_requests" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customer_contract_requests_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customer_contract_requests_fk" FOREIGN KEY ("customer_contract_requests_id") REFERENCES "public"."customer_contract_requests"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_customer_contract_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("customer_contract_requests_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customer_contract_requests_fk";
    DROP INDEX "payload_locked_documents_rels_customer_contract_requests_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customer_contract_requests_id";
    ALTER TABLE "customer_contract_requests" DISABLE ROW LEVEL SECURITY;
    DROP TABLE "customer_contract_requests" CASCADE;
    DROP TYPE "public"."enum_customer_contract_requests_recovery_potential";
    DROP TYPE "public"."enum_customer_contract_requests_status";
    DROP TYPE "public"."enum_customer_contract_requests_preferred_follow_up";
    DROP TYPE "public"."enum_customer_contract_requests_reason_code";
    DROP TYPE "public"."enum_customer_contract_requests_kind";
  `);
}
