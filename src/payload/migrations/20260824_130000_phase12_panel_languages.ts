import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_users_interface_language" AS ENUM('nb', 'lt', 'en');
    ALTER TABLE "users" ADD COLUMN "interface_language" "enum_users_interface_language" DEFAULT 'nb' NOT NULL;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN "interface_language";
    DROP TYPE "public"."enum_users_interface_language";
  `);
}
