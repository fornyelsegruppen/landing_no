import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_messages_category" ADD VALUE 'customer_question' BEFORE 'reminder';
  CREATE TABLE "messages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"private_media_id" integer
  );
  
  ALTER TABLE "messages_rels" ADD CONSTRAINT "messages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "messages_rels" ADD CONSTRAINT "messages_rels_private_media_fk" FOREIGN KEY ("private_media_id") REFERENCES "public"."private_media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "messages_rels_order_idx" ON "messages_rels" USING btree ("order");
  CREATE INDEX "messages_rels_parent_idx" ON "messages_rels" USING btree ("parent_id");
  CREATE INDEX "messages_rels_path_idx" ON "messages_rels" USING btree ("path");
  CREATE INDEX "messages_rels_private_media_id_idx" ON "messages_rels" USING btree ("private_media_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "messages_rels" CASCADE;
  UPDATE "messages" SET "category" = 'follow_up' WHERE "category" = 'customer_question';
  ALTER TABLE "messages" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_messages_category";
  CREATE TYPE "public"."enum_messages_category" AS ENUM('receipt', 'ai_reply', 'information_request', 'follow_up', 'quote', 'contract', 'reminder');
  ALTER TABLE "messages" ALTER COLUMN "category" SET DATA TYPE "public"."enum_messages_category" USING "category"::"public"."enum_messages_category";`)
}
