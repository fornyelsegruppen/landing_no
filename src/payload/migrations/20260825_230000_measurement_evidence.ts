import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_roof_measurements_measurement_mode" AS ENUM('schematic', 'schematic_with_context', 'manual_no_visual');
    CREATE TYPE "public"."enum_roof_measurements_manual_area_source" AS ENUM('customer', 'drawing', 'admin_estimate', 'onsite');
    ALTER TABLE "roof_measurements" ALTER COLUMN "latitude" DROP NOT NULL;
    ALTER TABLE "roof_measurements" ALTER COLUMN "longitude" DROP NOT NULL;
    ALTER TABLE "roof_measurements" ADD COLUMN "measurement_mode" "enum_roof_measurements_measurement_mode" DEFAULT 'schematic' NOT NULL;
    ALTER TABLE "roof_measurements" ADD COLUMN "candidate_buildings" jsonb;
    ALTER TABLE "roof_measurements" ADD COLUMN "evidence_snapshot_id" integer;
    ALTER TABLE "roof_measurements" ADD COLUMN "evidence_hash" varchar;
    ALTER TABLE "roof_measurements" ADD COLUMN "evidence_source" varchar;
    ALTER TABLE "roof_measurements" ADD COLUMN "evidence_attribution" varchar;
    ALTER TABLE "roof_measurements" ADD COLUMN "evidence_generated_at" timestamp(3) with time zone;
    ALTER TABLE "roof_measurements" ADD COLUMN "imagery_captured_at" timestamp(3) with time zone;
    ALTER TABLE "roof_measurements" ADD COLUMN "selection_confirmed_by_id" integer;
    ALTER TABLE "roof_measurements" ADD COLUMN "selection_confirmed_at" timestamp(3) with time zone;
    ALTER TABLE "roof_measurements" ADD COLUMN "manual_area_source" "enum_roof_measurements_manual_area_source";
    ALTER TABLE "roof_measurements" ADD COLUMN "manual_area_reason" varchar;
    ALTER TABLE "roof_measurements" ADD CONSTRAINT "roof_measurements_evidence_snapshot_id_private_media_id_fk" FOREIGN KEY ("evidence_snapshot_id") REFERENCES "public"."private_media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "roof_measurements" ADD CONSTRAINT "roof_measurements_selection_confirmed_by_id_users_id_fk" FOREIGN KEY ("selection_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "roof_measurements_measurement_mode_idx" ON "roof_measurements" USING btree ("measurement_mode");
    CREATE INDEX "roof_measurements_evidence_snapshot_idx" ON "roof_measurements" USING btree ("evidence_snapshot_id");
    CREATE INDEX "roof_measurements_evidence_hash_idx" ON "roof_measurements" USING btree ("evidence_hash");
    CREATE INDEX "roof_measurements_selection_confirmed_by_idx" ON "roof_measurements" USING btree ("selection_confirmed_by_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "roof_measurements_selection_confirmed_by_idx";
    DROP INDEX "roof_measurements_evidence_hash_idx";
    DROP INDEX "roof_measurements_evidence_snapshot_idx";
    DROP INDEX "roof_measurements_measurement_mode_idx";
    ALTER TABLE "roof_measurements" DROP CONSTRAINT "roof_measurements_selection_confirmed_by_id_users_id_fk";
    ALTER TABLE "roof_measurements" DROP CONSTRAINT "roof_measurements_evidence_snapshot_id_private_media_id_fk";
    ALTER TABLE "roof_measurements" DROP COLUMN "manual_area_reason";
    ALTER TABLE "roof_measurements" DROP COLUMN "manual_area_source";
    ALTER TABLE "roof_measurements" DROP COLUMN "selection_confirmed_at";
    ALTER TABLE "roof_measurements" DROP COLUMN "selection_confirmed_by_id";
    ALTER TABLE "roof_measurements" DROP COLUMN "imagery_captured_at";
    ALTER TABLE "roof_measurements" DROP COLUMN "evidence_generated_at";
    ALTER TABLE "roof_measurements" DROP COLUMN "evidence_attribution";
    ALTER TABLE "roof_measurements" DROP COLUMN "evidence_source";
    ALTER TABLE "roof_measurements" DROP COLUMN "evidence_hash";
    ALTER TABLE "roof_measurements" DROP COLUMN "evidence_snapshot_id";
    ALTER TABLE "roof_measurements" DROP COLUMN "candidate_buildings";
    ALTER TABLE "roof_measurements" DROP COLUMN "measurement_mode";
    UPDATE "roof_measurements" SET "latitude" = 0 WHERE "latitude" IS NULL;
    UPDATE "roof_measurements" SET "longitude" = 0 WHERE "longitude" IS NULL;
    ALTER TABLE "roof_measurements" ALTER COLUMN "longitude" SET NOT NULL;
    ALTER TABLE "roof_measurements" ALTER COLUMN "latitude" SET NOT NULL;
    DROP TYPE "public"."enum_roof_measurements_manual_area_source";
    DROP TYPE "public"."enum_roof_measurements_measurement_mode";
  `);
}
