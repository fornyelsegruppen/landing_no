import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_seo_runs_trigger_source" AS ENUM('manual', 'cron', 'regenerate');
  ALTER TYPE "public"."enum_posts_editorial_status" ADD VALUE 'rejected' BEFORE 'approved';
  ALTER TYPE "public"."enum__posts_v_version_editorial_status" ADD VALUE 'rejected' BEFORE 'approved';
  CREATE TABLE "posts_review_flags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"flag" varchar
  );
  
  CREATE TABLE "posts_proposed_internal_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"href" varchar,
  	"anchor" varchar,
  	"reason" varchar
  );
  
  CREATE TABLE "_posts_v_version_review_flags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"flag" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_version_proposed_internal_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"href" varchar,
  	"anchor" varchar,
  	"reason" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "seo_topics_rejection_reasons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"reason" varchar NOT NULL
  );
  
  ALTER TABLE "posts" ADD COLUMN "quality_checks" jsonb;
  ALTER TABLE "posts" ADD COLUMN "image_brief" varchar;
  ALTER TABLE "posts" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "posts" ADD COLUMN "search_performance_impressions" numeric;
  ALTER TABLE "posts" ADD COLUMN "search_performance_clicks" numeric;
  ALTER TABLE "posts" ADD COLUMN "search_performance_ctr" numeric;
  ALTER TABLE "posts" ADD COLUMN "search_performance_average_position" numeric;
  ALTER TABLE "posts" ADD COLUMN "search_performance_updated_at" timestamp(3) with time zone;
  ALTER TABLE "posts" ADD COLUMN "search_performance_index_verdict" varchar;
  ALTER TABLE "posts" ADD COLUMN "search_performance_coverage_state" varchar;
  ALTER TABLE "posts" ADD COLUMN "search_performance_last_crawl_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_quality_checks" jsonb;
  ALTER TABLE "_posts_v" ADD COLUMN "version_image_brief" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_image_alt" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_search_performance_impressions" numeric;
  ALTER TABLE "_posts_v" ADD COLUMN "version_search_performance_clicks" numeric;
  ALTER TABLE "_posts_v" ADD COLUMN "version_search_performance_ctr" numeric;
  ALTER TABLE "_posts_v" ADD COLUMN "version_search_performance_average_position" numeric;
  ALTER TABLE "_posts_v" ADD COLUMN "version_search_performance_updated_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_search_performance_index_verdict" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_search_performance_coverage_state" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_search_performance_last_crawl_at" timestamp(3) with time zone;
  ALTER TABLE "seo_topics" ADD COLUMN "fingerprint" varchar;
  ALTER TABLE "seo_topics" ADD COLUMN "proposed_brief" jsonb;
  ALTER TABLE "seo_topics" ADD COLUMN "score_breakdown" jsonb;
  ALTER TABLE "seo_runs" ADD COLUMN "idempotency_key" varchar;
  ALTER TABLE "seo_runs" ADD COLUMN "trigger_source" "enum_seo_runs_trigger_source";
  ALTER TABLE "seo_runs" ADD COLUMN "week_key" varchar;
  ALTER TABLE "seo_runs" ADD COLUMN "slot" varchar;
  UPDATE "seo_topics" SET "fingerprint" = 'legacy-topic-' || "id"::text WHERE "fingerprint" IS NULL;
  UPDATE "seo_runs" SET "idempotency_key" = 'legacy-run-' || "id"::text WHERE "idempotency_key" IS NULL;
  UPDATE "seo_runs" SET "trigger_source" = 'manual' WHERE "trigger_source" IS NULL;
  ALTER TABLE "seo_topics" ALTER COLUMN "fingerprint" SET NOT NULL;
  ALTER TABLE "seo_runs" ALTER COLUMN "idempotency_key" SET NOT NULL;
  ALTER TABLE "seo_runs" ALTER COLUMN "trigger_source" SET NOT NULL;
  ALTER TABLE "posts_review_flags" ADD CONSTRAINT "posts_review_flags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_proposed_internal_links" ADD CONSTRAINT "posts_proposed_internal_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_review_flags" ADD CONSTRAINT "_posts_v_version_review_flags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_proposed_internal_links" ADD CONSTRAINT "_posts_v_version_proposed_internal_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_topics_rejection_reasons" ADD CONSTRAINT "seo_topics_rejection_reasons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_topics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_review_flags_order_idx" ON "posts_review_flags" USING btree ("_order");
  CREATE INDEX "posts_review_flags_parent_id_idx" ON "posts_review_flags" USING btree ("_parent_id");
  CREATE INDEX "posts_proposed_internal_links_order_idx" ON "posts_proposed_internal_links" USING btree ("_order");
  CREATE INDEX "posts_proposed_internal_links_parent_id_idx" ON "posts_proposed_internal_links" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_review_flags_order_idx" ON "_posts_v_version_review_flags" USING btree ("_order");
  CREATE INDEX "_posts_v_version_review_flags_parent_id_idx" ON "_posts_v_version_review_flags" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_proposed_internal_links_order_idx" ON "_posts_v_version_proposed_internal_links" USING btree ("_order");
  CREATE INDEX "_posts_v_version_proposed_internal_links_parent_id_idx" ON "_posts_v_version_proposed_internal_links" USING btree ("_parent_id");
  CREATE INDEX "seo_topics_rejection_reasons_order_idx" ON "seo_topics_rejection_reasons" USING btree ("_order");
  CREATE INDEX "seo_topics_rejection_reasons_parent_id_idx" ON "seo_topics_rejection_reasons" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "seo_topics_fingerprint_idx" ON "seo_topics" USING btree ("fingerprint");
  CREATE UNIQUE INDEX "seo_runs_idempotency_key_idx" ON "seo_runs" USING btree ("idempotency_key");
  CREATE INDEX "seo_runs_week_key_idx" ON "seo_runs" USING btree ("week_key");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_review_flags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_proposed_internal_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_review_flags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_proposed_internal_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "seo_topics_rejection_reasons" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts_review_flags" CASCADE;
  DROP TABLE "posts_proposed_internal_links" CASCADE;
  DROP TABLE "_posts_v_version_review_flags" CASCADE;
  DROP TABLE "_posts_v_version_proposed_internal_links" CASCADE;
  DROP TABLE "seo_topics_rejection_reasons" CASCADE;
  UPDATE "posts" SET "editorial_status" = 'draft' WHERE "editorial_status" = 'rejected';
  UPDATE "_posts_v" SET "version_editorial_status" = 'draft' WHERE "version_editorial_status" = 'rejected';
  ALTER TABLE "posts" ALTER COLUMN "editorial_status" SET DATA TYPE text;
  ALTER TABLE "posts" ALTER COLUMN "editorial_status" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum_posts_editorial_status";
  CREATE TYPE "public"."enum_posts_editorial_status" AS ENUM('draft', 'ai_qa', 'human_review', 'approved', 'scheduled', 'published');
  ALTER TABLE "posts" ALTER COLUMN "editorial_status" SET DEFAULT 'draft'::"public"."enum_posts_editorial_status";
  ALTER TABLE "posts" ALTER COLUMN "editorial_status" SET DATA TYPE "public"."enum_posts_editorial_status" USING "editorial_status"::"public"."enum_posts_editorial_status";
  ALTER TABLE "_posts_v" ALTER COLUMN "version_editorial_status" SET DATA TYPE text;
  ALTER TABLE "_posts_v" ALTER COLUMN "version_editorial_status" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum__posts_v_version_editorial_status";
  CREATE TYPE "public"."enum__posts_v_version_editorial_status" AS ENUM('draft', 'ai_qa', 'human_review', 'approved', 'scheduled', 'published');
  ALTER TABLE "_posts_v" ALTER COLUMN "version_editorial_status" SET DEFAULT 'draft'::"public"."enum__posts_v_version_editorial_status";
  ALTER TABLE "_posts_v" ALTER COLUMN "version_editorial_status" SET DATA TYPE "public"."enum__posts_v_version_editorial_status" USING "version_editorial_status"::"public"."enum__posts_v_version_editorial_status";
  DROP INDEX "seo_topics_fingerprint_idx";
  DROP INDEX "seo_runs_idempotency_key_idx";
  DROP INDEX "seo_runs_week_key_idx";
  ALTER TABLE "posts" DROP COLUMN "quality_checks";
  ALTER TABLE "posts" DROP COLUMN "image_brief";
  ALTER TABLE "posts" DROP COLUMN "image_alt";
  ALTER TABLE "posts" DROP COLUMN "search_performance_impressions";
  ALTER TABLE "posts" DROP COLUMN "search_performance_clicks";
  ALTER TABLE "posts" DROP COLUMN "search_performance_ctr";
  ALTER TABLE "posts" DROP COLUMN "search_performance_average_position";
  ALTER TABLE "posts" DROP COLUMN "search_performance_updated_at";
  ALTER TABLE "posts" DROP COLUMN "search_performance_index_verdict";
  ALTER TABLE "posts" DROP COLUMN "search_performance_coverage_state";
  ALTER TABLE "posts" DROP COLUMN "search_performance_last_crawl_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_quality_checks";
  ALTER TABLE "_posts_v" DROP COLUMN "version_image_brief";
  ALTER TABLE "_posts_v" DROP COLUMN "version_image_alt";
  ALTER TABLE "_posts_v" DROP COLUMN "version_search_performance_impressions";
  ALTER TABLE "_posts_v" DROP COLUMN "version_search_performance_clicks";
  ALTER TABLE "_posts_v" DROP COLUMN "version_search_performance_ctr";
  ALTER TABLE "_posts_v" DROP COLUMN "version_search_performance_average_position";
  ALTER TABLE "_posts_v" DROP COLUMN "version_search_performance_updated_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_search_performance_index_verdict";
  ALTER TABLE "_posts_v" DROP COLUMN "version_search_performance_coverage_state";
  ALTER TABLE "_posts_v" DROP COLUMN "version_search_performance_last_crawl_at";
  ALTER TABLE "seo_topics" DROP COLUMN "fingerprint";
  ALTER TABLE "seo_topics" DROP COLUMN "proposed_brief";
  ALTER TABLE "seo_topics" DROP COLUMN "score_breakdown";
  ALTER TABLE "seo_runs" DROP COLUMN "idempotency_key";
  ALTER TABLE "seo_runs" DROP COLUMN "trigger_source";
  ALTER TABLE "seo_runs" DROP COLUMN "week_key";
  ALTER TABLE "seo_runs" DROP COLUMN "slot";
  DROP TYPE "public"."enum_seo_runs_trigger_source";`)
}
