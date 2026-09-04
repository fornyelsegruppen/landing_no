import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads"
      ADD COLUMN "address_revision" numeric DEFAULT 1 NOT NULL;

    CREATE TYPE "public"."enum_case_address_revisions_reason_code" AS ENUM(
      'operator_correction',
      'customer_confirmation',
      'provider_resolution',
      'data_quality_recovery'
    );
    CREATE TYPE "public"."enum_case_address_revisions_rf_invalidation_status" AS ENUM(
      'invalidated',
      'not_applicable'
    );
    CREATE TABLE "case_address_revisions" (
      "id" serial PRIMARY KEY NOT NULL,
      "ledger_key" varchar NOT NULL,
      "revision_key" varchar NOT NULL,
      "lead_id" integer,
      "case_id" varchar NOT NULL,
      "address_revision" numeric NOT NULL,
      "previous_address_revision" numeric NOT NULL,
      "expected_case_revision" numeric NOT NULL,
      "resulting_case_revision" numeric NOT NULL,
      "idempotency_key" varchar NOT NULL,
      "command_hash" varchar NOT NULL,
      "correlation_id" varchar NOT NULL,
      "actor_id" integer,
      "reason_code" "enum_case_address_revisions_reason_code" NOT NULL,
      "before" jsonb NOT NULL,
      "after" jsonb NOT NULL,
      "before_hash" varchar NOT NULL,
      "after_hash" varchar NOT NULL,
      "rf_invalidation_status" "enum_case_address_revisions_rf_invalidation_status" NOT NULL,
      "invalidated_rf_snapshot_id" varchar,
      "invalidated_rf_snapshot_revision" numeric,
      "invalidated_rf_snapshot_hash" varchar,
      "occurred_at" timestamp(3) with time zone NOT NULL,
      "result" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "case_address_revisions_address_revision_positive" CHECK ("address_revision" >= 2),
      CONSTRAINT "case_address_revisions_previous_revision_positive" CHECK ("previous_address_revision" >= 1),
      CONSTRAINT "case_address_revisions_case_revision_positive" CHECK ("expected_case_revision" >= 1 AND "resulting_case_revision" = "expected_case_revision" + 1),
      CONSTRAINT "case_address_revisions_address_revision_consecutive" CHECK ("address_revision" = "previous_address_revision" + 1),
      CONSTRAINT "case_address_revisions_rf_invalidation_complete" CHECK (
        ("rf_invalidation_status" = 'not_applicable'
          AND "invalidated_rf_snapshot_id" IS NULL
          AND "invalidated_rf_snapshot_revision" IS NULL
          AND "invalidated_rf_snapshot_hash" IS NULL)
        OR
        ("rf_invalidation_status" = 'invalidated'
          AND "invalidated_rf_snapshot_id" IS NOT NULL
          AND "invalidated_rf_snapshot_revision" >= 1
          AND "invalidated_rf_snapshot_hash" IS NOT NULL)
      )
    );

    ALTER TABLE "case_address_revisions"
      ADD CONSTRAINT "case_address_revisions_lead_id_leads_id_fk"
      FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "case_address_revisions"
      ADD CONSTRAINT "case_address_revisions_actor_id_users_id_fk"
      FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "case_address_revisions_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_case_address_revisions_fk"
      FOREIGN KEY ("case_address_revisions_id") REFERENCES "public"."case_address_revisions"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE UNIQUE INDEX "case_address_revisions_ledger_key_idx"
      ON "case_address_revisions" USING btree ("ledger_key");
    CREATE UNIQUE INDEX "case_address_revisions_revision_key_idx"
      ON "case_address_revisions" USING btree ("revision_key");
    CREATE UNIQUE INDEX "case_address_revisions_case_address_revision_idx"
      ON "case_address_revisions" USING btree ("case_id", "address_revision");
    CREATE INDEX "case_address_revisions_lead_idx"
      ON "case_address_revisions" USING btree ("lead_id");
    CREATE INDEX "case_address_revisions_case_id_idx"
      ON "case_address_revisions" USING btree ("case_id");
    CREATE INDEX "case_address_revisions_idempotency_key_idx"
      ON "case_address_revisions" USING btree ("idempotency_key");
    CREATE INDEX "case_address_revisions_command_hash_idx"
      ON "case_address_revisions" USING btree ("command_hash");
    CREATE INDEX "case_address_revisions_correlation_id_idx"
      ON "case_address_revisions" USING btree ("correlation_id");
    CREATE INDEX "case_address_revisions_actor_idx"
      ON "case_address_revisions" USING btree ("actor_id");
    CREATE INDEX "case_address_revisions_before_hash_idx"
      ON "case_address_revisions" USING btree ("before_hash");
    CREATE INDEX "case_address_revisions_after_hash_idx"
      ON "case_address_revisions" USING btree ("after_hash");
    CREATE INDEX "case_address_revisions_invalidated_snapshot_id_idx"
      ON "case_address_revisions" USING btree ("invalidated_rf_snapshot_id");
    CREATE INDEX "case_address_revisions_invalidated_snapshot_hash_idx"
      ON "case_address_revisions" USING btree ("invalidated_rf_snapshot_hash");
    CREATE INDEX "case_address_revisions_occurred_at_idx"
      ON "case_address_revisions" USING btree ("occurred_at");
    CREATE INDEX "case_address_revisions_updated_at_idx"
      ON "case_address_revisions" USING btree ("updated_at");
    CREATE INDEX "case_address_revisions_created_at_idx"
      ON "case_address_revisions" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_case_address_revisions_id_idx"
      ON "payload_locked_documents_rels" USING btree ("case_address_revisions_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_case_address_revisions_fk";
    DROP INDEX "payload_locked_documents_rels_case_address_revisions_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "case_address_revisions_id";
    DROP TABLE "case_address_revisions" CASCADE;
    DROP TYPE "public"."enum_case_address_revisions_rf_invalidation_status";
    DROP TYPE "public"."enum_case_address_revisions_reason_code";
    ALTER TABLE "leads" DROP COLUMN "address_revision";
  `);
}
