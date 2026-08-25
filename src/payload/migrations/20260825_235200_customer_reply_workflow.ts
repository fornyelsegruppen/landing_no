import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_leads_status" ADD VALUE IF NOT EXISTS 'customer_waiting' BEFORE 'waiting_customer';

    ALTER TABLE "messages" ADD COLUMN "reply_to_message_id" integer;
    ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "messages_reply_to_message_idx" ON "messages" USING btree ("reply_to_message_id");

    ALTER TABLE "quotes" ADD COLUMN "decline_reason" varchar;
    ALTER TABLE "quotes" ADD COLUMN "decline_comment" varchar;

    ALTER TABLE "work_orders" ADD COLUMN "customer_cancellation_requested_at" timestamp(3) with time zone;
    ALTER TABLE "work_orders" ADD COLUMN "cancellation_request_message_id" integer;
    ALTER TABLE "work_orders" ADD COLUMN "status_before_customer_cancellation" varchar;
    ALTER TABLE "work_orders" ADD COLUMN "customer_cancellation_resolved_at" timestamp(3) with time zone;
    ALTER TABLE "work_orders" ADD COLUMN "customer_cancellation_resolution" varchar;
    ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_cancellation_request_message_id_messages_id_fk" FOREIGN KEY ("cancellation_request_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "work_orders_customer_cancellation_requested_at_idx" ON "work_orders" USING btree ("customer_cancellation_requested_at");
    CREATE INDEX "work_orders_cancellation_request_message_idx" ON "work_orders" USING btree ("cancellation_request_message_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "work_orders_cancellation_request_message_idx";
    DROP INDEX IF EXISTS "work_orders_customer_cancellation_requested_at_idx";
    ALTER TABLE "work_orders" DROP CONSTRAINT IF EXISTS "work_orders_cancellation_request_message_id_messages_id_fk";
    ALTER TABLE "work_orders" DROP COLUMN IF EXISTS "customer_cancellation_resolution";
    ALTER TABLE "work_orders" DROP COLUMN IF EXISTS "customer_cancellation_resolved_at";
    ALTER TABLE "work_orders" DROP COLUMN IF EXISTS "status_before_customer_cancellation";
    ALTER TABLE "work_orders" DROP COLUMN IF EXISTS "cancellation_request_message_id";
    ALTER TABLE "work_orders" DROP COLUMN IF EXISTS "customer_cancellation_requested_at";

    ALTER TABLE "quotes" DROP COLUMN IF EXISTS "decline_comment";
    ALTER TABLE "quotes" DROP COLUMN IF EXISTS "decline_reason";

    DROP INDEX IF EXISTS "messages_reply_to_message_idx";
    ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_reply_to_message_id_messages_id_fk";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "reply_to_message_id";

    ALTER TABLE "leads" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TYPE "public"."enum_leads_status" RENAME TO "enum_leads_status_f8";
    CREATE TYPE "public"."enum_leads_status" AS ENUM('new', 'draft_ready', 'waiting_customer', 'qualified', 'measuring', 'quoted', 'converted', 'closed', 'contacted');
    ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE "public"."enum_leads_status" USING (CASE WHEN "status"::text = 'customer_waiting' THEN 'draft_ready' ELSE "status"::text END)::"public"."enum_leads_status";
    ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new'::"public"."enum_leads_status";
    DROP TYPE "public"."enum_leads_status_f8";
  `);
}
