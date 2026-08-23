import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_posts_content_audit_recommendation" AS ENUM('keep', 'update', 'merge', 'redirect');
  CREATE TYPE "public"."enum__posts_v_version_content_audit_recommendation" AS ENUM('keep', 'update', 'merge', 'redirect');
  ALTER TABLE "posts" ADD COLUMN "lead_performance_leads" numeric;
  ALTER TABLE "posts" ADD COLUMN "lead_performance_converted_leads" numeric;
  ALTER TABLE "posts" ADD COLUMN "lead_performance_updated_at" timestamp(3) with time zone;
  ALTER TABLE "posts" ADD COLUMN "content_audit_recommendation" "enum_posts_content_audit_recommendation";
  ALTER TABLE "posts" ADD COLUMN "content_audit_reason" varchar;
  ALTER TABLE "posts" ADD COLUMN "content_audit_generated_at" timestamp(3) with time zone;
  ALTER TABLE "posts" ADD COLUMN "content_audit_target_post_id" integer;
  ALTER TABLE "posts" ADD COLUMN "content_audit_reviewed_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_lead_performance_leads" numeric;
  ALTER TABLE "_posts_v" ADD COLUMN "version_lead_performance_converted_leads" numeric;
  ALTER TABLE "_posts_v" ADD COLUMN "version_lead_performance_updated_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_content_audit_recommendation" "enum__posts_v_version_content_audit_recommendation";
  ALTER TABLE "_posts_v" ADD COLUMN "version_content_audit_reason" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_content_audit_generated_at" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_content_audit_target_post_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_content_audit_reviewed_at" timestamp(3) with time zone;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_content_audit_target_post_id_posts_id_fk" FOREIGN KEY ("content_audit_target_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_content_audit_target_post_id_posts_id_fk" FOREIGN KEY ("version_content_audit_target_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "posts_content_audit_content_audit_target_post_idx" ON "posts" USING btree ("content_audit_target_post_id");
  CREATE INDEX "_posts_v_version_content_audit_version_content_audit_tar_idx" ON "_posts_v" USING btree ("version_content_audit_target_post_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DROP CONSTRAINT "posts_content_audit_target_post_id_posts_id_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_content_audit_target_post_id_posts_id_fk";
  
  DROP INDEX "posts_content_audit_content_audit_target_post_idx";
  DROP INDEX "_posts_v_version_content_audit_version_content_audit_tar_idx";
  ALTER TABLE "posts" DROP COLUMN "lead_performance_leads";
  ALTER TABLE "posts" DROP COLUMN "lead_performance_converted_leads";
  ALTER TABLE "posts" DROP COLUMN "lead_performance_updated_at";
  ALTER TABLE "posts" DROP COLUMN "content_audit_recommendation";
  ALTER TABLE "posts" DROP COLUMN "content_audit_reason";
  ALTER TABLE "posts" DROP COLUMN "content_audit_generated_at";
  ALTER TABLE "posts" DROP COLUMN "content_audit_target_post_id";
  ALTER TABLE "posts" DROP COLUMN "content_audit_reviewed_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_lead_performance_leads";
  ALTER TABLE "_posts_v" DROP COLUMN "version_lead_performance_converted_leads";
  ALTER TABLE "_posts_v" DROP COLUMN "version_lead_performance_updated_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_content_audit_recommendation";
  ALTER TABLE "_posts_v" DROP COLUMN "version_content_audit_reason";
  ALTER TABLE "_posts_v" DROP COLUMN "version_content_audit_generated_at";
  ALTER TABLE "_posts_v" DROP COLUMN "version_content_audit_target_post_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_content_audit_reviewed_at";
  DROP TYPE "public"."enum_posts_content_audit_recommendation";
  DROP TYPE "public"."enum__posts_v_version_content_audit_recommendation";`)
}
