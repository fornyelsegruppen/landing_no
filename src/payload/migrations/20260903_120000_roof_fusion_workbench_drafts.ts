import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "roof_fusion_workbench_drafts" (
      "id" serial PRIMARY KEY NOT NULL,
      "draft_id" varchar NOT NULL,
      "case_id" varchar NOT NULL,
      "case_revision_key" varchar NOT NULL,
      "revision" numeric NOT NULL,
      "supersedes_draft_id" varchar,
      "draft_hash" varchar NOT NULL,
      "idempotency_key" varchar NOT NULL,
      "state" varchar NOT NULL,
      "source_content_hash" varchar NOT NULL,
      "draft" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "roof_fusion_workbench_drafts_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_roof_fusion_workbench_drafts_fk"
      FOREIGN KEY ("roof_fusion_workbench_drafts_id") REFERENCES "public"."roof_fusion_workbench_drafts"("id")
      ON DELETE cascade ON UPDATE no action;
    CREATE UNIQUE INDEX "roof_fusion_workbench_drafts_draft_id_idx"
      ON "roof_fusion_workbench_drafts" USING btree ("draft_id");
    CREATE UNIQUE INDEX "roof_fusion_workbench_drafts_case_revision_key_idx"
      ON "roof_fusion_workbench_drafts" USING btree ("case_revision_key");
    CREATE UNIQUE INDEX "roof_fusion_workbench_drafts_case_id_revision_idx"
      ON "roof_fusion_workbench_drafts" USING btree ("case_id", "revision");
    CREATE UNIQUE INDEX "roof_fusion_workbench_drafts_idempotency_key_idx"
      ON "roof_fusion_workbench_drafts" USING btree ("idempotency_key");
    CREATE INDEX "roof_fusion_workbench_drafts_case_id_idx"
      ON "roof_fusion_workbench_drafts" USING btree ("case_id");
    CREATE INDEX "roof_fusion_workbench_drafts_revision_idx"
      ON "roof_fusion_workbench_drafts" USING btree ("revision");
    CREATE INDEX "roof_fusion_workbench_drafts_draft_hash_idx"
      ON "roof_fusion_workbench_drafts" USING btree ("draft_hash");
    CREATE INDEX "roof_fusion_workbench_drafts_state_idx"
      ON "roof_fusion_workbench_drafts" USING btree ("state");
    CREATE INDEX "roof_fusion_workbench_drafts_source_content_hash_idx"
      ON "roof_fusion_workbench_drafts" USING btree ("source_content_hash");
    CREATE INDEX "payload_locked_documents_rels_roof_fusion_workbench_drafts_id_idx"
      ON "payload_locked_documents_rels" USING btree ("roof_fusion_workbench_drafts_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_roof_fusion_workbench_drafts_fk";
    DROP INDEX "payload_locked_documents_rels_roof_fusion_workbench_drafts_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "roof_fusion_workbench_drafts_id";
    DROP TABLE "roof_fusion_workbench_drafts" CASCADE;
  `);
}
