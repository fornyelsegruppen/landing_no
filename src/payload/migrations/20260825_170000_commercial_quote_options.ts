import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_quotes_option_kind" AS ENUM('base', 'recommended');
    ALTER TABLE "quotes" ADD COLUMN "option_group" varchar;
    ALTER TABLE "quotes" ADD COLUMN "option_kind" "enum_quotes_option_kind";
    ALTER TABLE "quotes" ADD COLUMN "sibling_quote_id" integer;
    ALTER TABLE "quotes" ADD COLUMN "selected_option_quote_id" integer;
    ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sibling_quote_id_quotes_id_fk" FOREIGN KEY ("sibling_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "quotes" ADD CONSTRAINT "quotes_selected_option_quote_id_quotes_id_fk" FOREIGN KEY ("selected_option_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "quotes_option_group_idx" ON "quotes" USING btree ("option_group");
    CREATE INDEX "quotes_sibling_quote_idx" ON "quotes" USING btree ("sibling_quote_id");
    CREATE INDEX "quotes_selected_option_quote_idx" ON "quotes" USING btree ("selected_option_quote_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "quotes" DROP CONSTRAINT "quotes_sibling_quote_id_quotes_id_fk";
    ALTER TABLE "quotes" DROP CONSTRAINT "quotes_selected_option_quote_id_quotes_id_fk";
    DROP INDEX "quotes_option_group_idx";
    DROP INDEX "quotes_sibling_quote_idx";
    DROP INDEX "quotes_selected_option_quote_idx";
    ALTER TABLE "quotes" DROP COLUMN "option_group";
    ALTER TABLE "quotes" DROP COLUMN "option_kind";
    ALTER TABLE "quotes" DROP COLUMN "sibling_quote_id";
    ALTER TABLE "quotes" DROP COLUMN "selected_option_quote_id";
    DROP TYPE "public"."enum_quotes_option_kind";
  `);
}
