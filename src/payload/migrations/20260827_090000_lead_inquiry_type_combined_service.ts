import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_leads_type"
      ADD VALUE IF NOT EXISTS 'takvask_impregnering';
  `);
}

export async function down(args: MigrateDownArgs): Promise<void> {
  void args;
  // PostgreSQL cannot remove an enum label without recreating the enum type.
  // Keeping this additive label is the safe rollback path because existing
  // leads may already reference it after the migration has been applied.
}
