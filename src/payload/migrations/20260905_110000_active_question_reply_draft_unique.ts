import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX "messages_one_active_question_reply_draft_idx"
      ON "messages" USING btree ("reply_to_message_id")
      WHERE "direction" = 'outbound'
        AND "status" = 'draft'
        AND "reply_to_message_id" IS NOT NULL;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "messages_one_active_question_reply_draft_idx";
  `);
}
