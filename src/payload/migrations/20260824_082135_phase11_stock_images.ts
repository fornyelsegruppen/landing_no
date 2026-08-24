import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_stock_provider" AS ENUM('manual', 'pexels');
  ALTER TABLE "media" ADD COLUMN "stock_provider" "enum_media_stock_provider" DEFAULT 'manual';
  ALTER TABLE "media" ADD COLUMN "stock_asset_id" varchar;
  ALTER TABLE "media" ADD COLUMN "stock_source_url" varchar;
  ALTER TABLE "media" ADD COLUMN "stock_photographer" varchar;
  ALTER TABLE "media" ADD COLUMN "stock_photographer_url" varchar;
  ALTER TABLE "media" ADD COLUMN "stock_license_url" varchar;
  ALTER TABLE "media" ADD COLUMN "stock_retrieved_at" timestamp(3) with time zone;
  ALTER TABLE "media" ADD COLUMN "stock_query" varchar;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP COLUMN "stock_provider";
  ALTER TABLE "media" DROP COLUMN "stock_asset_id";
  ALTER TABLE "media" DROP COLUMN "stock_source_url";
  ALTER TABLE "media" DROP COLUMN "stock_photographer";
  ALTER TABLE "media" DROP COLUMN "stock_photographer_url";
  ALTER TABLE "media" DROP COLUMN "stock_license_url";
  ALTER TABLE "media" DROP COLUMN "stock_retrieved_at";
  ALTER TABLE "media" DROP COLUMN "stock_query";
  DROP TYPE "public"."enum_media_stock_provider";`);
}
