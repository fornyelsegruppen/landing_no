import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "roof_fusion_snapshots" (
      "id" serial PRIMARY KEY NOT NULL,
      "snapshot_id" varchar NOT NULL,
      "case_id" varchar NOT NULL,
      "case_revision_key" varchar NOT NULL,
      "revision" numeric NOT NULL,
      "supersedes_snapshot_id" varchar,
      "snapshot_hash" varchar NOT NULL,
      "state" varchar NOT NULL,
      "measurement_class" varchar NOT NULL,
      "snapshot" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "roof_fusion_commands" (
      "id" serial PRIMARY KEY NOT NULL,
      "ledger_key" varchar NOT NULL,
      "case_id" varchar NOT NULL,
      "idempotency_key" varchar NOT NULL,
      "command_hash" varchar NOT NULL,
      "command_type" varchar NOT NULL,
      "snapshot_id" varchar NOT NULL,
      "result" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "roof_fusion_snapshots_id" integer,
      ADD COLUMN "roof_fusion_commands_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_roof_fusion_snapshots_fk"
      FOREIGN KEY ("roof_fusion_snapshots_id") REFERENCES "public"."roof_fusion_snapshots"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_roof_fusion_commands_fk"
      FOREIGN KEY ("roof_fusion_commands_id") REFERENCES "public"."roof_fusion_commands"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE UNIQUE INDEX "roof_fusion_snapshots_snapshot_id_idx"
      ON "roof_fusion_snapshots" USING btree ("snapshot_id");
    CREATE UNIQUE INDEX "roof_fusion_snapshots_case_revision_key_idx"
      ON "roof_fusion_snapshots" USING btree ("case_revision_key");
    CREATE UNIQUE INDEX "roof_fusion_snapshots_case_revision_idx"
      ON "roof_fusion_snapshots" USING btree ("case_id", "revision");
    CREATE INDEX "roof_fusion_snapshots_case_id_idx"
      ON "roof_fusion_snapshots" USING btree ("case_id");
    CREATE INDEX "roof_fusion_snapshots_revision_idx"
      ON "roof_fusion_snapshots" USING btree ("revision");
    CREATE INDEX "roof_fusion_snapshots_supersedes_snapshot_id_idx"
      ON "roof_fusion_snapshots" USING btree ("supersedes_snapshot_id");
    CREATE INDEX "roof_fusion_snapshots_snapshot_hash_idx"
      ON "roof_fusion_snapshots" USING btree ("snapshot_hash");
    CREATE INDEX "roof_fusion_snapshots_state_idx"
      ON "roof_fusion_snapshots" USING btree ("state");
    CREATE INDEX "roof_fusion_snapshots_measurement_class_idx"
      ON "roof_fusion_snapshots" USING btree ("measurement_class");
    CREATE INDEX "roof_fusion_snapshots_updated_at_idx"
      ON "roof_fusion_snapshots" USING btree ("updated_at");
    CREATE INDEX "roof_fusion_snapshots_created_at_idx"
      ON "roof_fusion_snapshots" USING btree ("created_at");

    CREATE UNIQUE INDEX "roof_fusion_commands_ledger_key_idx"
      ON "roof_fusion_commands" USING btree ("ledger_key");
    CREATE UNIQUE INDEX "roof_fusion_commands_case_id_idempotency_key_idx"
      ON "roof_fusion_commands" USING btree ("case_id", "idempotency_key");
    CREATE INDEX "roof_fusion_commands_case_id_idx"
      ON "roof_fusion_commands" USING btree ("case_id");
    CREATE INDEX "roof_fusion_commands_idempotency_key_idx"
      ON "roof_fusion_commands" USING btree ("idempotency_key");
    CREATE INDEX "roof_fusion_commands_command_hash_idx"
      ON "roof_fusion_commands" USING btree ("command_hash");
    CREATE INDEX "roof_fusion_commands_command_type_idx"
      ON "roof_fusion_commands" USING btree ("command_type");
    CREATE INDEX "roof_fusion_commands_snapshot_id_idx"
      ON "roof_fusion_commands" USING btree ("snapshot_id");
    CREATE INDEX "roof_fusion_commands_updated_at_idx"
      ON "roof_fusion_commands" USING btree ("updated_at");
    CREATE INDEX "roof_fusion_commands_created_at_idx"
      ON "roof_fusion_commands" USING btree ("created_at");

    CREATE INDEX "payload_locked_documents_rels_roof_fusion_snapshots_id_idx"
      ON "payload_locked_documents_rels" USING btree ("roof_fusion_snapshots_id");
    CREATE INDEX "payload_locked_documents_rels_roof_fusion_commands_id_idx"
      ON "payload_locked_documents_rels" USING btree ("roof_fusion_commands_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_roof_fusion_snapshots_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_roof_fusion_commands_fk";
    DROP INDEX "payload_locked_documents_rels_roof_fusion_snapshots_id_idx";
    DROP INDEX "payload_locked_documents_rels_roof_fusion_commands_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "roof_fusion_snapshots_id",
      DROP COLUMN "roof_fusion_commands_id";
    DROP TABLE "roof_fusion_commands" CASCADE;
    DROP TABLE "roof_fusion_snapshots" CASCADE;
  `);
}
