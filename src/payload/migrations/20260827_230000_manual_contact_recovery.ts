import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads"
      ADD COLUMN IF NOT EXISTS "communication_email" varchar,
      ADD COLUMN IF NOT EXISTS "communication_email_updated_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "communication_email_source_message_id" integer;

    DO $manual_contact_fk$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'leads_communication_email_source_message_id_messages_id_fk'
      ) THEN
        ALTER TABLE "leads"
          ADD CONSTRAINT "leads_communication_email_source_message_id_messages_id_fk"
          FOREIGN KEY ("communication_email_source_message_id")
          REFERENCES "public"."messages"("id")
          ON DELETE set null
          ON UPDATE no action;
      END IF;
    END
    $manual_contact_fk$;

    CREATE INDEX IF NOT EXISTS "leads_communication_email_idx"
      ON "leads" USING btree ("communication_email");
    CREATE INDEX IF NOT EXISTS "leads_communication_email_source_message_idx"
      ON "leads" USING btree ("communication_email_source_message_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "leads_communication_email_source_message_idx";
    DROP INDEX IF EXISTS "leads_communication_email_idx";
    ALTER TABLE "leads"
      DROP CONSTRAINT IF EXISTS "leads_communication_email_source_message_id_messages_id_fk";
    ALTER TABLE "leads"
      DROP COLUMN IF EXISTS "communication_email_source_message_id",
      DROP COLUMN IF EXISTS "communication_email_updated_at",
      DROP COLUMN IF EXISTS "communication_email";
  `);
}
