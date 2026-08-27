import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $prod7_combined_service$
    DECLARE
      target_enum text;
    BEGIN
      SELECT format('%I.%I', type_namespace.nspname, enum_type.typname)
      INTO target_enum
      FROM pg_attribute attribute
      JOIN pg_class relation ON relation.oid = attribute.attrelid
      JOIN pg_namespace relation_namespace ON relation_namespace.oid = relation.relnamespace
      JOIN pg_type enum_type ON enum_type.oid = attribute.atttypid
      JOIN pg_namespace type_namespace ON type_namespace.oid = enum_type.typnamespace
      WHERE relation_namespace.nspname = 'public'
        AND relation.relname = 'leads'
        AND attribute.attname = 'inquiry_type'
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND enum_type.typtype = 'e'
      LIMIT 1;

      IF target_enum IS NOT NULL THEN
        EXECUTE format(
          'ALTER TYPE %s ADD VALUE IF NOT EXISTS %L',
          target_enum,
          'takvask_impregnering'
        );
      END IF;
    END
    $prod7_combined_service$;
  `);
}

export async function down(args: MigrateDownArgs): Promise<void> {
  void args;
  // PostgreSQL cannot remove an enum label without recreating the enum type.
  // Keeping this additive label is the safe rollback path because existing
  // leads may already reference it after the migration has been applied.
}
