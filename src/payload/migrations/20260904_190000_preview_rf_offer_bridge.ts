import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_roof_measurements_source_kind" AS ENUM(
      'legacy',
      'roof_fusion'
    );
    ALTER TABLE "roof_measurements"
      ADD COLUMN "source_kind" "enum_roof_measurements_source_kind" DEFAULT 'legacy' NOT NULL,
      ADD COLUMN "case_revision" numeric,
      ADD COLUMN "address_revision" numeric,
      ADD COLUMN "rf_snapshot_id" varchar,
      ADD COLUMN "rf_snapshot_revision" numeric,
      ADD COLUMN "rf_snapshot_hash" varchar,
      ADD COLUMN "rf_input_hash" varchar,
      ADD COLUMN "rf_renderer_hash" varchar,
      ADD CONSTRAINT "roof_measurements_rf_binding_complete" CHECK (
        ("source_kind" = 'legacy'
          AND "case_revision" IS NULL
          AND "address_revision" IS NULL
          AND "rf_snapshot_id" IS NULL
          AND "rf_snapshot_revision" IS NULL
          AND "rf_snapshot_hash" IS NULL
          AND "rf_input_hash" IS NULL
          AND "rf_renderer_hash" IS NULL)
        OR
        ("source_kind" = 'roof_fusion'
          AND "case_revision" >= 1
          AND "address_revision" >= 1
          AND "rf_snapshot_id" IS NOT NULL
          AND "rf_snapshot_revision" >= 1
          AND "rf_snapshot_hash" ~ '^[a-f0-9]{64}$'
          AND "rf_input_hash" ~ '^[a-f0-9]{64}$'
          AND "rf_renderer_hash" ~ '^[a-f0-9]{64}$')
      );

    CREATE TABLE "roof_fusion_offer_commands" (
      "id" serial PRIMARY KEY NOT NULL,
      "ledger_key" varchar NOT NULL,
      "idempotency_scope_key" varchar NOT NULL,
      "case_id" varchar NOT NULL,
      "idempotency_key" varchar NOT NULL,
      "command_hash" varchar NOT NULL,
      "case_revision" numeric NOT NULL,
      "address_revision" numeric NOT NULL,
      "snapshot_id" varchar NOT NULL,
      "snapshot_revision" numeric NOT NULL,
      "snapshot_hash" varchar NOT NULL,
      "input_hash" varchar NOT NULL,
      "renderer_hash" varchar NOT NULL,
      "measurement_id" integer NOT NULL,
      "quote_id" integer NOT NULL,
      "contract_id" integer NOT NULL,
      "actor_id" integer NOT NULL,
      "correlation_id" varchar NOT NULL,
      "occurred_at" timestamp(3) with time zone NOT NULL,
      "result" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "rf_offer_commands_revisions_positive" CHECK (
        "case_revision" >= 1
        AND "address_revision" >= 1
        AND "snapshot_revision" >= 1
      ),
      CONSTRAINT "rf_offer_commands_hashes" CHECK (
        "command_hash" ~ '^[a-f0-9]{64}$'
        AND "snapshot_hash" ~ '^[a-f0-9]{64}$'
        AND "input_hash" ~ '^[a-f0-9]{64}$'
        AND "renderer_hash" ~ '^[a-f0-9]{64}$'
      )
    );

    ALTER TABLE "roof_fusion_offer_commands"
      ADD CONSTRAINT "rf_offer_commands_measurement_fk"
      FOREIGN KEY ("measurement_id") REFERENCES "public"."roof_measurements"("id")
      ON DELETE restrict ON UPDATE no action,
      ADD CONSTRAINT "rf_offer_commands_quote_fk"
      FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id")
      ON DELETE restrict ON UPDATE no action,
      ADD CONSTRAINT "rf_offer_commands_contract_fk"
      FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id")
      ON DELETE restrict ON UPDATE no action,
      ADD CONSTRAINT "rf_offer_commands_actor_fk"
      FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id")
      ON DELETE restrict ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "roof_fusion_offer_commands_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_rf_offer_commands_fk"
      FOREIGN KEY ("roof_fusion_offer_commands_id")
      REFERENCES "public"."roof_fusion_offer_commands"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "roof_measurements_source_kind_idx"
      ON "roof_measurements" USING btree ("source_kind");
    CREATE INDEX "roof_measurements_case_revision_idx"
      ON "roof_measurements" USING btree ("case_revision");
    CREATE INDEX "roof_measurements_address_revision_idx"
      ON "roof_measurements" USING btree ("address_revision");
    CREATE INDEX "roof_measurements_rf_snapshot_id_idx"
      ON "roof_measurements" USING btree ("rf_snapshot_id");
    CREATE INDEX "roof_measurements_rf_snapshot_hash_idx"
      ON "roof_measurements" USING btree ("rf_snapshot_hash");
    CREATE INDEX "roof_measurements_rf_input_hash_idx"
      ON "roof_measurements" USING btree ("rf_input_hash");
    CREATE INDEX "roof_measurements_rf_renderer_hash_idx"
      ON "roof_measurements" USING btree ("rf_renderer_hash");

    CREATE UNIQUE INDEX "rf_offer_commands_ledger_key_idx"
      ON "roof_fusion_offer_commands" USING btree ("ledger_key");
    CREATE UNIQUE INDEX "rf_offer_commands_idempotency_scope_key_idx"
      ON "roof_fusion_offer_commands" USING btree ("idempotency_scope_key");
    CREATE INDEX "rf_offer_commands_case_id_idx"
      ON "roof_fusion_offer_commands" USING btree ("case_id");
    CREATE INDEX "rf_offer_commands_idempotency_key_idx"
      ON "roof_fusion_offer_commands" USING btree ("idempotency_key");
    CREATE INDEX "rf_offer_commands_command_hash_idx"
      ON "roof_fusion_offer_commands" USING btree ("command_hash");
    CREATE INDEX "rf_offer_commands_snapshot_id_idx"
      ON "roof_fusion_offer_commands" USING btree ("snapshot_id");
    CREATE INDEX "rf_offer_commands_snapshot_hash_idx"
      ON "roof_fusion_offer_commands" USING btree ("snapshot_hash");
    CREATE INDEX "rf_offer_commands_input_hash_idx"
      ON "roof_fusion_offer_commands" USING btree ("input_hash");
    CREATE INDEX "rf_offer_commands_renderer_hash_idx"
      ON "roof_fusion_offer_commands" USING btree ("renderer_hash");
    CREATE INDEX "rf_offer_commands_measurement_idx"
      ON "roof_fusion_offer_commands" USING btree ("measurement_id");
    CREATE INDEX "rf_offer_commands_quote_idx"
      ON "roof_fusion_offer_commands" USING btree ("quote_id");
    CREATE INDEX "rf_offer_commands_contract_idx"
      ON "roof_fusion_offer_commands" USING btree ("contract_id");
    CREATE INDEX "rf_offer_commands_actor_idx"
      ON "roof_fusion_offer_commands" USING btree ("actor_id");
    CREATE INDEX "rf_offer_commands_correlation_idx"
      ON "roof_fusion_offer_commands" USING btree ("correlation_id");
    CREATE INDEX "rf_offer_commands_occurred_at_idx"
      ON "roof_fusion_offer_commands" USING btree ("occurred_at");
    CREATE INDEX "rf_offer_commands_updated_at_idx"
      ON "roof_fusion_offer_commands" USING btree ("updated_at");
    CREATE INDEX "rf_offer_commands_created_at_idx"
      ON "roof_fusion_offer_commands" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_rf_offer_commands_id_idx"
      ON "payload_locked_documents_rels" USING btree ("roof_fusion_offer_commands_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_rf_offer_commands_fk";
    DROP INDEX "payload_locked_documents_rels_rf_offer_commands_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "roof_fusion_offer_commands_id";
    DROP TABLE "roof_fusion_offer_commands" CASCADE;

    DROP INDEX "roof_measurements_rf_renderer_hash_idx";
    DROP INDEX "roof_measurements_rf_input_hash_idx";
    DROP INDEX "roof_measurements_rf_snapshot_hash_idx";
    DROP INDEX "roof_measurements_rf_snapshot_id_idx";
    DROP INDEX "roof_measurements_address_revision_idx";
    DROP INDEX "roof_measurements_case_revision_idx";
    DROP INDEX "roof_measurements_source_kind_idx";
    ALTER TABLE "roof_measurements"
      DROP CONSTRAINT "roof_measurements_rf_binding_complete",
      DROP COLUMN "rf_renderer_hash",
      DROP COLUMN "rf_input_hash",
      DROP COLUMN "rf_snapshot_hash",
      DROP COLUMN "rf_snapshot_revision",
      DROP COLUMN "rf_snapshot_id",
      DROP COLUMN "address_revision",
      DROP COLUMN "case_revision",
      DROP COLUMN "source_kind";
    DROP TYPE "public"."enum_roof_measurements_source_kind";
  `);
}
