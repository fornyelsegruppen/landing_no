import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_posts_editorial_status" AS ENUM('draft', 'ai_qa', 'human_review', 'approved', 'scheduled', 'published');
  CREATE TYPE "public"."enum_posts_search_intent" AS ENUM('informational', 'commercial', 'local', 'comparison');
  CREATE TYPE "public"."enum_posts_cta_variant" AS ENUM('assessment', 'wash', 'renewal', 'new_roof');
  CREATE TYPE "public"."enum__posts_v_version_editorial_status" AS ENUM('draft', 'ai_qa', 'human_review', 'approved', 'scheduled', 'published');
  CREATE TYPE "public"."enum__posts_v_version_search_intent" AS ENUM('informational', 'commercial', 'local', 'comparison');
  CREATE TYPE "public"."enum__posts_v_version_cta_variant" AS ENUM('assessment', 'wash', 'renewal', 'new_roof');
  CREATE TYPE "public"."enum_seo_topics_search_intent" AS ENUM('informational', 'commercial', 'local', 'comparison');
  CREATE TYPE "public"."enum_seo_topics_source" AS ENUM('search_console', 'ads', 'trends', 'lead', 'manual');
  CREATE TYPE "public"."enum_seo_topics_status" AS ENUM('candidate', 'rejected', 'queued', 'drafted', 'approved', 'published');
  CREATE TYPE "public"."enum_seo_runs_status" AS ENUM('running', 'completed', 'failed', 'attention');
  CREATE TABLE "posts_secondary_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar
  );
  
  CREATE TABLE "posts_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"publisher" varchar,
  	"accessed_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "posts_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question_no" varchar,
  	"answer_no" varchar,
  	"question_en" varchar,
  	"answer_en" varchar
  );
  
  CREATE TABLE "posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"posts_id" integer,
  	"services_id" integer
  );
  
  CREATE TABLE "_posts_v_version_secondary_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"keyword" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"publisher" varchar,
  	"accessed_at" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_version_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question_no" varchar,
  	"answer_no" varchar,
  	"question_en" varchar,
  	"answer_en" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"posts_id" integer,
  	"services_id" integer
  );
  
  CREATE TABLE "seo_topics_secondary_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar NOT NULL
  );
  
  CREATE TABLE "seo_topics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"topic" varchar NOT NULL,
  	"primary_keyword" varchar NOT NULL,
  	"search_intent" "enum_seo_topics_search_intent" NOT NULL,
  	"service_id" integer,
  	"location" varchar,
  	"season" varchar,
  	"source" "enum_seo_topics_source" NOT NULL,
  	"source_metrics" jsonb,
  	"topic_score" numeric DEFAULT 0 NOT NULL,
  	"overlap_score" numeric DEFAULT 0 NOT NULL,
  	"reason_for_selection" varchar NOT NULL,
  	"status" "enum_seo_topics_status" DEFAULT 'candidate' NOT NULL,
  	"checked_at" timestamp(3) with time zone,
  	"related_post_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "seo_runs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"job_type" varchar NOT NULL,
  	"status" "enum_seo_runs_status" DEFAULT 'running' NOT NULL,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"finished_at" timestamp(3) with time zone,
  	"model_version" varchar,
  	"prompt_version" varchar,
  	"knowledge_version" varchar,
  	"quality_result" jsonb,
  	"error_code" varchar,
  	"error_message" varchar,
  	"created_post_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "seo_runs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"seo_topics_id" integer
  );
  
  ALTER TABLE "posts" ADD COLUMN "editorial_status" "enum_posts_editorial_status" DEFAULT 'draft';
  ALTER TABLE "posts" ADD COLUMN "scheduled_at" timestamp(3) with time zone;
  ALTER TABLE "posts" ADD COLUMN "search_intent" "enum_posts_search_intent";
  ALTER TABLE "posts" ADD COLUMN "primary_keyword" varchar;
  ALTER TABLE "posts" ADD COLUMN "primary_service_id" integer;
  ALTER TABLE "posts" ADD COLUMN "location_text" varchar;
  ALTER TABLE "posts" ADD COLUMN "category" varchar;
  ALTER TABLE "posts" ADD COLUMN "author_name" varchar;
  ALTER TABLE "posts" ADD COLUMN "reviewer_name" varchar;
  ALTER TABLE "posts" ADD COLUMN "reviewed_at" timestamp(3) with time zone;
  ALTER TABLE "posts" ADD COLUMN "ai_assisted" boolean DEFAULT false;
  ALTER TABLE "posts" ADD COLUMN "ai_generation_run_id" integer;
  ALTER TABLE "posts" ADD COLUMN "quality_score" numeric;
  ALTER TABLE "posts" ADD COLUMN "cta_variant" "enum_posts_cta_variant" DEFAULT 'assessment';
  ALTER TABLE "posts" ADD COLUMN "last_content_audit_at" timestamp(3) with time zone;
  ALTER TABLE "posts" ADD COLUMN "performance_notes" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_editorial_status" "enum__posts_v_version_editorial_status" DEFAULT 'draft';
  ALTER TABLE "_posts_v" ADD COLUMN "version_scheduled_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_search_intent" "enum__posts_v_version_search_intent";
  ALTER TABLE "_posts_v" ADD COLUMN "version_primary_keyword" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_primary_service_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_location_text" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_category" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_author_name" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_reviewer_name" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_reviewed_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_ai_assisted" boolean DEFAULT false;
  ALTER TABLE "_posts_v" ADD COLUMN "version_ai_generation_run_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_quality_score" numeric;
  ALTER TABLE "_posts_v" ADD COLUMN "version_cta_variant" "enum__posts_v_version_cta_variant" DEFAULT 'assessment';
  ALTER TABLE "_posts_v" ADD COLUMN "version_last_content_audit_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_performance_notes" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "autosave" boolean;
  ALTER TABLE "leads" ADD COLUMN "content_source_path" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "seo_topics_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "seo_runs_id" integer;
  ALTER TABLE "posts_secondary_keywords" ADD CONSTRAINT "posts_secondary_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_sources" ADD CONSTRAINT "posts_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_faq_items" ADD CONSTRAINT "posts_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_secondary_keywords" ADD CONSTRAINT "_posts_v_version_secondary_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_sources" ADD CONSTRAINT "_posts_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_faq_items" ADD CONSTRAINT "_posts_v_version_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_topics_secondary_keywords" ADD CONSTRAINT "seo_topics_secondary_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_topics" ADD CONSTRAINT "seo_topics_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seo_topics" ADD CONSTRAINT "seo_topics_related_post_id_posts_id_fk" FOREIGN KEY ("related_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seo_runs" ADD CONSTRAINT "seo_runs_created_post_id_posts_id_fk" FOREIGN KEY ("created_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seo_runs_rels" ADD CONSTRAINT "seo_runs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."seo_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_runs_rels" ADD CONSTRAINT "seo_runs_rels_seo_topics_fk" FOREIGN KEY ("seo_topics_id") REFERENCES "public"."seo_topics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_secondary_keywords_order_idx" ON "posts_secondary_keywords" USING btree ("_order");
  CREATE INDEX "posts_secondary_keywords_parent_id_idx" ON "posts_secondary_keywords" USING btree ("_parent_id");
  CREATE INDEX "posts_sources_order_idx" ON "posts_sources" USING btree ("_order");
  CREATE INDEX "posts_sources_parent_id_idx" ON "posts_sources" USING btree ("_parent_id");
  CREATE INDEX "posts_faq_items_order_idx" ON "posts_faq_items" USING btree ("_order");
  CREATE INDEX "posts_faq_items_parent_id_idx" ON "posts_faq_items" USING btree ("_parent_id");
  CREATE INDEX "posts_rels_order_idx" ON "posts_rels" USING btree ("order");
  CREATE INDEX "posts_rels_parent_idx" ON "posts_rels" USING btree ("parent_id");
  CREATE INDEX "posts_rels_path_idx" ON "posts_rels" USING btree ("path");
  CREATE INDEX "posts_rels_posts_id_idx" ON "posts_rels" USING btree ("posts_id");
  CREATE INDEX "posts_rels_services_id_idx" ON "posts_rels" USING btree ("services_id");
  CREATE INDEX "_posts_v_version_secondary_keywords_order_idx" ON "_posts_v_version_secondary_keywords" USING btree ("_order");
  CREATE INDEX "_posts_v_version_secondary_keywords_parent_id_idx" ON "_posts_v_version_secondary_keywords" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_sources_order_idx" ON "_posts_v_version_sources" USING btree ("_order");
  CREATE INDEX "_posts_v_version_sources_parent_id_idx" ON "_posts_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_faq_items_order_idx" ON "_posts_v_version_faq_items" USING btree ("_order");
  CREATE INDEX "_posts_v_version_faq_items_parent_id_idx" ON "_posts_v_version_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_rels_order_idx" ON "_posts_v_rels" USING btree ("order");
  CREATE INDEX "_posts_v_rels_parent_idx" ON "_posts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_posts_v_rels_path_idx" ON "_posts_v_rels" USING btree ("path");
  CREATE INDEX "_posts_v_rels_posts_id_idx" ON "_posts_v_rels" USING btree ("posts_id");
  CREATE INDEX "_posts_v_rels_services_id_idx" ON "_posts_v_rels" USING btree ("services_id");
  CREATE INDEX "seo_topics_secondary_keywords_order_idx" ON "seo_topics_secondary_keywords" USING btree ("_order");
  CREATE INDEX "seo_topics_secondary_keywords_parent_id_idx" ON "seo_topics_secondary_keywords" USING btree ("_parent_id");
  CREATE INDEX "seo_topics_topic_idx" ON "seo_topics" USING btree ("topic");
  CREATE INDEX "seo_topics_primary_keyword_idx" ON "seo_topics" USING btree ("primary_keyword");
  CREATE INDEX "seo_topics_service_idx" ON "seo_topics" USING btree ("service_id");
  CREATE INDEX "seo_topics_status_idx" ON "seo_topics" USING btree ("status");
  CREATE INDEX "seo_topics_related_post_idx" ON "seo_topics" USING btree ("related_post_id");
  CREATE INDEX "seo_topics_updated_at_idx" ON "seo_topics" USING btree ("updated_at");
  CREATE INDEX "seo_topics_created_at_idx" ON "seo_topics" USING btree ("created_at");
  CREATE INDEX "seo_runs_job_type_idx" ON "seo_runs" USING btree ("job_type");
  CREATE INDEX "seo_runs_status_idx" ON "seo_runs" USING btree ("status");
  CREATE INDEX "seo_runs_started_at_idx" ON "seo_runs" USING btree ("started_at");
  CREATE INDEX "seo_runs_created_post_idx" ON "seo_runs" USING btree ("created_post_id");
  CREATE INDEX "seo_runs_updated_at_idx" ON "seo_runs" USING btree ("updated_at");
  CREATE INDEX "seo_runs_created_at_idx" ON "seo_runs" USING btree ("created_at");
  CREATE INDEX "seo_runs_rels_order_idx" ON "seo_runs_rels" USING btree ("order");
  CREATE INDEX "seo_runs_rels_parent_idx" ON "seo_runs_rels" USING btree ("parent_id");
  CREATE INDEX "seo_runs_rels_path_idx" ON "seo_runs_rels" USING btree ("path");
  CREATE INDEX "seo_runs_rels_seo_topics_id_idx" ON "seo_runs_rels" USING btree ("seo_topics_id");
  ALTER TABLE "posts" ADD CONSTRAINT "posts_primary_service_id_services_id_fk" FOREIGN KEY ("primary_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_ai_generation_run_id_seo_runs_id_fk" FOREIGN KEY ("ai_generation_run_id") REFERENCES "public"."seo_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_primary_service_id_services_id_fk" FOREIGN KEY ("version_primary_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_ai_generation_run_id_seo_runs_id_fk" FOREIGN KEY ("version_ai_generation_run_id") REFERENCES "public"."seo_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seo_topics_fk" FOREIGN KEY ("seo_topics_id") REFERENCES "public"."seo_topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seo_runs_fk" FOREIGN KEY ("seo_runs_id") REFERENCES "public"."seo_runs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_editorial_status_idx" ON "posts" USING btree ("editorial_status");
  CREATE INDEX "posts_scheduled_at_idx" ON "posts" USING btree ("scheduled_at");
  CREATE INDEX "posts_primary_keyword_idx" ON "posts" USING btree ("primary_keyword");
  CREATE INDEX "posts_primary_service_idx" ON "posts" USING btree ("primary_service_id");
  CREATE INDEX "posts_ai_generation_run_idx" ON "posts" USING btree ("ai_generation_run_id");
  CREATE INDEX "_posts_v_version_version_editorial_status_idx" ON "_posts_v" USING btree ("version_editorial_status");
  CREATE INDEX "_posts_v_version_version_scheduled_at_idx" ON "_posts_v" USING btree ("version_scheduled_at");
  CREATE INDEX "_posts_v_version_version_primary_keyword_idx" ON "_posts_v" USING btree ("version_primary_keyword");
  CREATE INDEX "_posts_v_version_version_primary_service_idx" ON "_posts_v" USING btree ("version_primary_service_id");
  CREATE INDEX "_posts_v_version_version_ai_generation_run_idx" ON "_posts_v" USING btree ("version_ai_generation_run_id");
  CREATE INDEX "_posts_v_autosave_idx" ON "_posts_v" USING btree ("autosave");
  CREATE INDEX "payload_locked_documents_rels_seo_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("seo_topics_id");
  CREATE INDEX "payload_locked_documents_rels_seo_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("seo_runs_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_secondary_keywords" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_faq_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_secondary_keywords" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_faq_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "seo_topics_secondary_keywords" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "seo_topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "seo_runs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "seo_runs_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts_secondary_keywords" CASCADE;
  DROP TABLE "posts_sources" CASCADE;
  DROP TABLE "posts_faq_items" CASCADE;
  DROP TABLE "posts_rels" CASCADE;
  DROP TABLE "_posts_v_version_secondary_keywords" CASCADE;
  DROP TABLE "_posts_v_version_sources" CASCADE;
  DROP TABLE "_posts_v_version_faq_items" CASCADE;
  DROP TABLE "_posts_v_rels" CASCADE;
  DROP TABLE "seo_topics_secondary_keywords" CASCADE;
  DROP TABLE "seo_topics" CASCADE;
  DROP TABLE "seo_runs" CASCADE;
  DROP TABLE "seo_runs_rels" CASCADE;
  ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_primary_service_id_services_id_fk";
  
  ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_ai_generation_run_id_seo_runs_id_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT IF EXISTS "_posts_v_version_primary_service_id_services_id_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT IF EXISTS "_posts_v_version_ai_generation_run_id_seo_runs_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_seo_topics_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_seo_runs_fk";
  
  DROP INDEX "posts_editorial_status_idx";
  DROP INDEX "posts_scheduled_at_idx";
  DROP INDEX "posts_primary_keyword_idx";
  DROP INDEX "posts_primary_service_idx";
  DROP INDEX "posts_ai_generation_run_idx";
  DROP INDEX "_posts_v_version_version_editorial_status_idx";
  DROP INDEX "_posts_v_version_version_scheduled_at_idx";
  DROP INDEX "_posts_v_version_version_primary_keyword_idx";
  DROP INDEX "_posts_v_version_version_primary_service_idx";
  DROP INDEX "_posts_v_version_version_ai_generation_run_idx";
  DROP INDEX "_posts_v_autosave_idx";
  DROP INDEX "payload_locked_documents_rels_seo_topics_id_idx";
  DROP INDEX "payload_locked_documents_rels_seo_runs_id_idx";
  ALTER TABLE "posts" DROP COLUMN "editorial_status";
  ALTER TABLE "posts" DROP COLUMN "scheduled_at";
  ALTER TABLE "posts" DROP COLUMN "search_intent";
  ALTER TABLE "posts" DROP COLUMN "primary_keyword";
  ALTER TABLE "posts" DROP COLUMN "primary_service_id";
  ALTER TABLE "posts" DROP COLUMN "location_text";
  ALTER TABLE "posts" DROP COLUMN "category";
  ALTER TABLE "posts" DROP COLUMN "author_name";
  ALTER TABLE "posts" DROP COLUMN "reviewer_name";
  ALTER TABLE "posts" DROP COLUMN "reviewed_at";
  ALTER TABLE "posts" DROP COLUMN "ai_assisted";
  ALTER TABLE "posts" DROP COLUMN "ai_generation_run_id";
  ALTER TABLE "posts" DROP COLUMN "quality_score";
  ALTER TABLE "posts" DROP COLUMN "cta_variant";
  ALTER TABLE "posts" DROP COLUMN "last_content_audit_at";
  ALTER TABLE "posts" DROP COLUMN "performance_notes";
  ALTER TABLE "_posts_v" DROP COLUMN "version_editorial_status";
  ALTER TABLE "_posts_v" DROP COLUMN "version_scheduled_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_search_intent";
  ALTER TABLE "_posts_v" DROP COLUMN "version_primary_keyword";
  ALTER TABLE "_posts_v" DROP COLUMN "version_primary_service_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_location_text";
  ALTER TABLE "_posts_v" DROP COLUMN "version_category";
  ALTER TABLE "_posts_v" DROP COLUMN "version_author_name";
  ALTER TABLE "_posts_v" DROP COLUMN "version_reviewer_name";
  ALTER TABLE "_posts_v" DROP COLUMN "version_reviewed_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_ai_assisted";
  ALTER TABLE "_posts_v" DROP COLUMN "version_ai_generation_run_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_quality_score";
  ALTER TABLE "_posts_v" DROP COLUMN "version_cta_variant";
  ALTER TABLE "_posts_v" DROP COLUMN "version_last_content_audit_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_performance_notes";
  ALTER TABLE "_posts_v" DROP COLUMN "autosave";
  ALTER TABLE "leads" DROP COLUMN "content_source_path";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "seo_topics_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "seo_runs_id";
  DROP TYPE "public"."enum_posts_editorial_status";
  DROP TYPE "public"."enum_posts_search_intent";
  DROP TYPE "public"."enum_posts_cta_variant";
  DROP TYPE "public"."enum__posts_v_version_editorial_status";
  DROP TYPE "public"."enum__posts_v_version_search_intent";
  DROP TYPE "public"."enum__posts_v_version_cta_variant";
  DROP TYPE "public"."enum_seo_topics_search_intent";
  DROP TYPE "public"."enum_seo_topics_source";
  DROP TYPE "public"."enum_seo_topics_status";
  DROP TYPE "public"."enum_seo_runs_status";`)
}
