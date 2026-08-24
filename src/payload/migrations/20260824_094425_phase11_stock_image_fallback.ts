import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" ADD COLUMN "stock_image_provider" varchar;
  ALTER TABLE "posts" ADD COLUMN "stock_image_asset_id" varchar;
  ALTER TABLE "posts" ADD COLUMN "stock_image_image_url" varchar;
  ALTER TABLE "posts" ADD COLUMN "stock_image_source_url" varchar;
  ALTER TABLE "posts" ADD COLUMN "stock_image_photographer" varchar;
  ALTER TABLE "posts" ADD COLUMN "stock_image_photographer_url" varchar;
  ALTER TABLE "posts" ADD COLUMN "stock_image_license_url" varchar;
  ALTER TABLE "posts" ADD COLUMN "stock_image_query" varchar;
  ALTER TABLE "posts" ADD COLUMN "stock_image_selected_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_stock_image_provider" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_stock_image_asset_id" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_stock_image_image_url" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_stock_image_source_url" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_stock_image_photographer" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_stock_image_photographer_url" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_stock_image_license_url" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_stock_image_query" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_stock_image_selected_at" timestamp(3) with time zone;`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DROP COLUMN "stock_image_provider";
  ALTER TABLE "posts" DROP COLUMN "stock_image_asset_id";
  ALTER TABLE "posts" DROP COLUMN "stock_image_image_url";
  ALTER TABLE "posts" DROP COLUMN "stock_image_source_url";
  ALTER TABLE "posts" DROP COLUMN "stock_image_photographer";
  ALTER TABLE "posts" DROP COLUMN "stock_image_photographer_url";
  ALTER TABLE "posts" DROP COLUMN "stock_image_license_url";
  ALTER TABLE "posts" DROP COLUMN "stock_image_query";
  ALTER TABLE "posts" DROP COLUMN "stock_image_selected_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_stock_image_provider";
  ALTER TABLE "_posts_v" DROP COLUMN "version_stock_image_asset_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_stock_image_image_url";
  ALTER TABLE "_posts_v" DROP COLUMN "version_stock_image_source_url";
  ALTER TABLE "_posts_v" DROP COLUMN "version_stock_image_photographer";
  ALTER TABLE "_posts_v" DROP COLUMN "version_stock_image_photographer_url";
  ALTER TABLE "_posts_v" DROP COLUMN "version_stock_image_license_url";
  ALTER TABLE "_posts_v" DROP COLUMN "version_stock_image_query";
  ALTER TABLE "_posts_v" DROP COLUMN "version_stock_image_selected_at";`);
}
