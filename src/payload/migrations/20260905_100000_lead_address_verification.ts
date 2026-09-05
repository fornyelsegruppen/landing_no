import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_leads_address_verification_status" AS ENUM(
      'unverified',
      'manual',
      'verification_failed',
      'verified'
    );
    ALTER TABLE "leads"
      ADD COLUMN "address_verification_status" "enum_leads_address_verification_status",
      ADD COLUMN "address_verification_provider" varchar,
      ADD COLUMN "address_verification_provider_id" varchar,
      ADD COLUMN "address_latitude" numeric,
      ADD COLUMN "address_longitude" numeric,
      ADD COLUMN "address_verified_at" timestamp(3) with time zone,
      ADD CONSTRAINT "leads_address_verification_complete" CHECK (
        ("address_verification_status" = 'verified'
          AND "address_verification_provider" = 'kartverket-address-rest-v1'
          AND btrim("address_verification_provider_id") <> ''
          AND "address_latitude" BETWEEN 57 AND 72
          AND "address_longitude" BETWEEN 4 AND 32
          AND "address_verified_at" IS NOT NULL)
        OR
        (("address_verification_status" IS NULL
            OR "address_verification_status" <> 'verified')
          AND "address_verification_provider" IS NULL
          AND "address_verification_provider_id" IS NULL
          AND "address_latitude" IS NULL
          AND "address_longitude" IS NULL
          AND "address_verified_at" IS NULL)
      );
    CREATE INDEX "leads_address_verification_status_idx"
      ON "leads" USING btree ("address_verification_status");
    CREATE INDEX "leads_address_verification_provider_id_idx"
      ON "leads" USING btree ("address_verification_provider_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "leads_address_verification_provider_id_idx";
    DROP INDEX "leads_address_verification_status_idx";
    ALTER TABLE "leads"
      DROP CONSTRAINT "leads_address_verification_complete",
      DROP COLUMN "address_verified_at",
      DROP COLUMN "address_longitude",
      DROP COLUMN "address_latitude",
      DROP COLUMN "address_verification_provider_id",
      DROP COLUMN "address_verification_provider",
      DROP COLUMN "address_verification_status";
    DROP TYPE "public"."enum_leads_address_verification_status";
  `);
}
