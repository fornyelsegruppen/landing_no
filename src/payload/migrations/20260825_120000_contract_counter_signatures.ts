import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "contracts" ADD COLUMN "customer_signature_image_id" integer;
    ALTER TABLE "contracts" ADD COLUMN "company_signature_evidence" jsonb;
    ALTER TABLE "contracts" ADD COLUMN "company_signature_image_id" integer;
    ALTER TABLE "contracts" ADD COLUMN "company_signed_document_id" integer;
    ALTER TABLE "contracts" ADD COLUMN "company_signed_at" timestamp(3) with time zone;
    ALTER TABLE "contracts" ADD COLUMN "company_signed_by_id" integer;

    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_signature_image_id_private_media_id_fk" FOREIGN KEY ("customer_signature_image_id") REFERENCES "public"."private_media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_signature_image_id_private_media_id_fk" FOREIGN KEY ("company_signature_image_id") REFERENCES "public"."private_media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_signed_document_id_private_media_id_fk" FOREIGN KEY ("company_signed_document_id") REFERENCES "public"."private_media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_signed_by_id_users_id_fk" FOREIGN KEY ("company_signed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX "contracts_customer_signature_image_idx" ON "contracts" USING btree ("customer_signature_image_id");
    CREATE INDEX "contracts_company_signature_image_idx" ON "contracts" USING btree ("company_signature_image_id");
    CREATE INDEX "contracts_company_signed_document_idx" ON "contracts" USING btree ("company_signed_document_id");
    CREATE INDEX "contracts_company_signed_at_idx" ON "contracts" USING btree ("company_signed_at");
    CREATE INDEX "contracts_company_signed_by_idx" ON "contracts" USING btree ("company_signed_by_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "contracts" DROP CONSTRAINT "contracts_customer_signature_image_id_private_media_id_fk";
    ALTER TABLE "contracts" DROP CONSTRAINT "contracts_company_signature_image_id_private_media_id_fk";
    ALTER TABLE "contracts" DROP CONSTRAINT "contracts_company_signed_document_id_private_media_id_fk";
    ALTER TABLE "contracts" DROP CONSTRAINT "contracts_company_signed_by_id_users_id_fk";
    DROP INDEX "contracts_customer_signature_image_idx";
    DROP INDEX "contracts_company_signature_image_idx";
    DROP INDEX "contracts_company_signed_document_idx";
    DROP INDEX "contracts_company_signed_at_idx";
    DROP INDEX "contracts_company_signed_by_idx";
    ALTER TABLE "contracts" DROP COLUMN "customer_signature_image_id";
    ALTER TABLE "contracts" DROP COLUMN "company_signature_evidence";
    ALTER TABLE "contracts" DROP COLUMN "company_signature_image_id";
    ALTER TABLE "contracts" DROP COLUMN "company_signed_document_id";
    ALTER TABLE "contracts" DROP COLUMN "company_signed_at";
    ALTER TABLE "contracts" DROP COLUMN "company_signed_by_id";
  `);
}
