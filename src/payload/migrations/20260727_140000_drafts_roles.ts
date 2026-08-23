import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

/**
 * Phase 4: draft/version storage and admin/editor roles.
 *
 * Production disables Drizzle push, so the version tables must exist before
 * Payload can save or query drafts. Root version columns are mirrored from the
 * live tables to keep the large SiteSettings schema in sync and make re-runs
 * safe. Existing documents are also copied into an initial published version.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $migration$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_services_status') THEN
        CREATE TYPE "enum_services_status" AS ENUM ('draft', 'published');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_projects_status') THEN
        CREATE TYPE "enum_projects_status" AS ENUM ('draft', 'published');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_products_status') THEN
        CREATE TYPE "enum_products_status" AS ENUM ('draft', 'published');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_faq_status') THEN
        CREATE TYPE "enum_faq_status" AS ENUM ('draft', 'published');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_site_settings_status') THEN
        CREATE TYPE "enum_site_settings_status" AS ENUM ('draft', 'published');
      END IF;
    END
    $migration$;

    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "role" varchar DEFAULT 'admin';
    UPDATE "users" SET "role" = 'admin' WHERE "role" IS NULL;
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin';
    ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;

    ALTER TABLE "services"
      ADD COLUMN IF NOT EXISTS "_status" "enum_services_status";
    ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "_status" "enum_projects_status";
    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "_status" "enum_products_status";
    ALTER TABLE "faq"
      ADD COLUMN IF NOT EXISTS "_status" "enum_faq_status";
    ALTER TABLE "site_settings"
      ADD COLUMN IF NOT EXISTS "_status" "enum_site_settings_status";

    UPDATE "services" SET "_status" = 'published' WHERE "_status" IS NULL;
    UPDATE "projects" SET "_status" = 'published' WHERE "_status" IS NULL;
    UPDATE "products" SET "_status" = 'published' WHERE "_status" IS NULL;
    UPDATE "faq" SET "_status" = 'published' WHERE "_status" IS NULL;
    UPDATE "site_settings" SET "_status" = 'published' WHERE "_status" IS NULL;

    ALTER TABLE "services" ALTER COLUMN "_status" SET DEFAULT 'draft';
    ALTER TABLE "projects" ALTER COLUMN "_status" SET DEFAULT 'draft';
    ALTER TABLE "products" ALTER COLUMN "_status" SET DEFAULT 'draft';
    ALTER TABLE "faq" ALTER COLUMN "_status" SET DEFAULT 'draft';
    ALTER TABLE "site_settings" ALTER COLUMN "_status" SET DEFAULT 'draft';

    CREATE INDEX IF NOT EXISTS "services__status_idx" ON "services" ("_status");
    CREATE INDEX IF NOT EXISTS "projects__status_idx" ON "projects" ("_status");
    CREATE INDEX IF NOT EXISTS "products__status_idx" ON "products" ("_status");
    CREATE INDEX IF NOT EXISTS "faq__status_idx" ON "faq" ("_status");
    CREATE INDEX IF NOT EXISTS "site_settings__status_idx" ON "site_settings" ("_status");
  `);

  await db.execute(sql`
    DO $migration$
    DECLARE
      version_table record;
      source_column record;
      source_id_type text;
      target_columns text;
      source_columns text;
      parent_constraint text;
    BEGIN
      FOR version_table IN
        SELECT *
        FROM (
          VALUES
            ('services', '_services_v', true),
            ('projects', '_projects_v', true),
            ('products', '_products_v', true),
            ('faq', '_faq_v', true),
            ('site_settings', '_site_settings_v', false)
        ) AS configured(source_name, target_name, has_parent)
      LOOP
        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS %I ("id" serial PRIMARY KEY)',
          version_table.target_name
        );

        IF version_table.has_parent THEN
          SELECT format_type(attribute.atttypid, attribute.atttypmod)
          INTO source_id_type
          FROM pg_attribute AS attribute
          WHERE attribute.attrelid =
              to_regclass(format('public.%I', version_table.source_name))
            AND attribute.attname = 'id'
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped;

          EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS "parent_id" %s',
            version_table.target_name,
            source_id_type
          );
        END IF;

        FOR source_column IN
          SELECT
            attribute.attname AS column_name,
            format_type(attribute.atttypid, attribute.atttypmod) AS data_type
          FROM pg_attribute AS attribute
          WHERE attribute.attrelid =
              to_regclass(format('public.%I', version_table.source_name))
            AND attribute.attname <> 'id'
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
          ORDER BY attribute.attnum
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I %s',
            version_table.target_name,
            'version_' || source_column.column_name,
            source_column.data_type
          );
        END LOOP;

        EXECUTE format(
          'ALTER TABLE %I
             ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
             ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
             ADD COLUMN IF NOT EXISTS "latest" boolean',
          version_table.target_name
        );

        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN "version__status" SET DEFAULT %L',
          version_table.target_name,
          'draft'
        );

        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I ("created_at")',
          version_table.target_name || '_created_at_idx',
          version_table.target_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I ("updated_at")',
          version_table.target_name || '_updated_at_idx',
          version_table.target_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I ("latest")',
          version_table.target_name || '_latest_idx',
          version_table.target_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I ("version_updated_at")',
          version_table.target_name || '_version_version_updated_at_idx',
          version_table.target_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I ("version_created_at")',
          version_table.target_name || '_version_version_created_at_idx',
          version_table.target_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I ("version__status")',
          version_table.target_name || '_version_version__status_idx',
          version_table.target_name
        );

        IF version_table.has_parent THEN
          EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("parent_id")',
            version_table.target_name || '_parent_idx',
            version_table.target_name
          );

          parent_constraint :=
            version_table.target_name || '_parent_id_' ||
            version_table.source_name || '_id_fk';

          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = parent_constraint
              AND conrelid =
                to_regclass(format('public.%I', version_table.target_name))
          ) THEN
            EXECUTE format(
              'ALTER TABLE %I
                 ADD CONSTRAINT %I
                 FOREIGN KEY ("parent_id") REFERENCES %I ("id")
                 ON DELETE set null ON UPDATE no action',
              version_table.target_name,
              parent_constraint,
              version_table.source_name
            );
          END IF;
        END IF;

        SELECT
          string_agg(
            format('%I', 'version_' || source_attribute.attname),
            ', ' ORDER BY source_attribute.attnum
          ),
          string_agg(
            CASE
              WHEN source_attribute.atttypid <> target_attribute.atttypid
                AND source_type.typtype = 'e'
                AND target_type.typtype = 'e'
              THEN format(
                'source.%I::text::%s',
                source_attribute.attname,
                format_type(target_attribute.atttypid, target_attribute.atttypmod)
              )
              ELSE format('source.%I', source_attribute.attname)
            END,
            ', ' ORDER BY source_attribute.attnum
          )
        INTO target_columns, source_columns
        FROM pg_attribute AS source_attribute
        INNER JOIN pg_attribute AS target_attribute
          ON target_attribute.attrelid =
              to_regclass(format('public.%I', version_table.target_name))
          AND target_attribute.attname =
              'version_' || source_attribute.attname
          AND target_attribute.attnum > 0
          AND NOT target_attribute.attisdropped
        INNER JOIN pg_type AS source_type
          ON source_type.oid = source_attribute.atttypid
        INNER JOIN pg_type AS target_type
          ON target_type.oid = target_attribute.atttypid
        WHERE source_attribute.attrelid =
            to_regclass(format('public.%I', version_table.source_name))
          AND source_attribute.attname <> 'id'
          AND source_attribute.attnum > 0
          AND NOT source_attribute.attisdropped;

        IF version_table.has_parent THEN
          EXECUTE format(
            'INSERT INTO %I ("parent_id", %s, "created_at", "updated_at", "latest")
             SELECT source."id", %s, now(), now(), true
             FROM %I AS source
             WHERE NOT EXISTS (
               SELECT 1 FROM %I AS existing
               WHERE existing."parent_id" = source."id"
             )',
            version_table.target_name,
            target_columns,
            source_columns,
            version_table.source_name,
            version_table.target_name
          );
        ELSE
          EXECUTE format(
            'INSERT INTO %I (%s, "created_at", "updated_at", "latest")
             SELECT %s, now(), now(), true
             FROM %I AS source
             WHERE NOT EXISTS (SELECT 1 FROM %I)
             LIMIT 1',
            version_table.target_name,
            target_columns,
            source_columns,
            version_table.source_name,
            version_table.target_name
          );
        END IF;
      END LOOP;
    END
    $migration$;

    CREATE INDEX IF NOT EXISTS "_services_v_version_version_key_idx"
      ON "_services_v" ("version_key");
    CREATE INDEX IF NOT EXISTS "_products_v_version_version_image_idx"
      ON "_products_v" ("version_image_id");
    CREATE INDEX IF NOT EXISTS "_site_settings_v_version_version_logo_idx"
      ON "_site_settings_v" ("version_logo_id");
    CREATE INDEX IF NOT EXISTS "_site_settings_v_version_version_hero_image_idx"
      ON "_site_settings_v" ("version_hero_image_id");
    CREATE INDEX IF NOT EXISTS "_site_settings_v_version_version_about_image_idx"
      ON "_site_settings_v" ("version_about_image_id");
    CREATE INDEX IF NOT EXISTS "_site_settings_v_version_version_new_roof_image_idx"
      ON "_site_settings_v" ("version_new_roof_image_id");
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_projects_v_version_stages" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar,
      "caption_no" varchar,
      "caption_en" varchar,
      "image_id" integer,
      "image_url" varchar,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "_products_v_version_badges_no" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "_products_v_version_badges_en" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "_site_settings_v_version_nav_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "label_no" varchar,
      "label_en" varchar,
      "href" varchar,
      "visible" boolean DEFAULT true,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "_site_settings_v_version_testimonials_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "quote_no" varchar,
      "quote_en" varchar,
      "author_no" varchar,
      "author_en" varchar,
      "service_no" varchar,
      "service_en" varchar,
      "_uuid" varchar
    );

    CREATE INDEX IF NOT EXISTS "_projects_v_version_stages_order_idx"
      ON "_projects_v_version_stages" ("_order");
    CREATE INDEX IF NOT EXISTS "_projects_v_version_stages_parent_id_idx"
      ON "_projects_v_version_stages" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_projects_v_version_stages_image_idx"
      ON "_projects_v_version_stages" ("image_id");
    CREATE INDEX IF NOT EXISTS "_products_v_version_badges_no_order_idx"
      ON "_products_v_version_badges_no" ("_order");
    CREATE INDEX IF NOT EXISTS "_products_v_version_badges_no_parent_id_idx"
      ON "_products_v_version_badges_no" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_products_v_version_badges_en_order_idx"
      ON "_products_v_version_badges_en" ("_order");
    CREATE INDEX IF NOT EXISTS "_products_v_version_badges_en_parent_id_idx"
      ON "_products_v_version_badges_en" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_site_settings_v_version_nav_items_order_idx"
      ON "_site_settings_v_version_nav_items" ("_order");
    CREATE INDEX IF NOT EXISTS "_site_settings_v_version_nav_items_parent_id_idx"
      ON "_site_settings_v_version_nav_items" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_site_settings_v_version_testimonials_items_order_idx"
      ON "_site_settings_v_version_testimonials_items" ("_order");
    CREATE INDEX IF NOT EXISTS "_site_settings_v_version_testimonials_items_parent_id_idx"
      ON "_site_settings_v_version_testimonials_items" ("_parent_id");
  `);

  await db.execute(sql`
    DO $migration$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_products_v_version_image_id_media_id_fk'
          AND conrelid = '_products_v'::regclass
      ) THEN
        ALTER TABLE "_products_v"
          ADD CONSTRAINT "_products_v_version_image_id_media_id_fk"
          FOREIGN KEY ("version_image_id") REFERENCES "media" ("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_site_settings_v_version_logo_id_media_id_fk'
          AND conrelid = '_site_settings_v'::regclass
      ) THEN
        ALTER TABLE "_site_settings_v"
          ADD CONSTRAINT "_site_settings_v_version_logo_id_media_id_fk"
          FOREIGN KEY ("version_logo_id") REFERENCES "media" ("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_site_settings_v_version_hero_image_id_media_id_fk'
          AND conrelid = '_site_settings_v'::regclass
      ) THEN
        ALTER TABLE "_site_settings_v"
          ADD CONSTRAINT "_site_settings_v_version_hero_image_id_media_id_fk"
          FOREIGN KEY ("version_hero_image_id") REFERENCES "media" ("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_site_settings_v_version_about_image_id_media_id_fk'
          AND conrelid = '_site_settings_v'::regclass
      ) THEN
        ALTER TABLE "_site_settings_v"
          ADD CONSTRAINT "_site_settings_v_version_about_image_id_media_id_fk"
          FOREIGN KEY ("version_about_image_id") REFERENCES "media" ("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_site_settings_v_version_new_roof_image_id_media_id_fk'
          AND conrelid = '_site_settings_v'::regclass
      ) THEN
        ALTER TABLE "_site_settings_v"
          ADD CONSTRAINT "_site_settings_v_version_new_roof_image_id_media_id_fk"
          FOREIGN KEY ("version_new_roof_image_id") REFERENCES "media" ("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_projects_v_version_stages_image_id_media_id_fk'
          AND conrelid = '_projects_v_version_stages'::regclass
      ) THEN
        ALTER TABLE "_projects_v_version_stages"
          ADD CONSTRAINT "_projects_v_version_stages_image_id_media_id_fk"
          FOREIGN KEY ("image_id") REFERENCES "media" ("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_projects_v_version_stages_parent_id_fk'
          AND conrelid = '_projects_v_version_stages'::regclass
      ) THEN
        ALTER TABLE "_projects_v_version_stages"
          ADD CONSTRAINT "_projects_v_version_stages_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_projects_v" ("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_products_v_version_badges_no_parent_id_fk'
          AND conrelid = '_products_v_version_badges_no'::regclass
      ) THEN
        ALTER TABLE "_products_v_version_badges_no"
          ADD CONSTRAINT "_products_v_version_badges_no_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_products_v" ("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_products_v_version_badges_en_parent_id_fk'
          AND conrelid = '_products_v_version_badges_en'::regclass
      ) THEN
        ALTER TABLE "_products_v_version_badges_en"
          ADD CONSTRAINT "_products_v_version_badges_en_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_products_v" ("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_site_settings_v_version_nav_items_parent_id_fk'
          AND conrelid = '_site_settings_v_version_nav_items'::regclass
      ) THEN
        ALTER TABLE "_site_settings_v_version_nav_items"
          ADD CONSTRAINT "_site_settings_v_version_nav_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_site_settings_v" ("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '_site_settings_v_version_testimonials_items_parent_id_fk'
          AND conrelid = '_site_settings_v_version_testimonials_items'::regclass
      ) THEN
        ALTER TABLE "_site_settings_v_version_testimonials_items"
          ADD CONSTRAINT "_site_settings_v_version_testimonials_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_site_settings_v" ("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END
    $migration$;
  `);

  await db.execute(sql`
    DO $stage_backfill$
    DECLARE
      label_expression text;
    BEGIN
      SELECT
        CASE
          WHEN target_type.typtype = 'e'
          THEN format(
            'source."label"::text::%s',
            format_type(target_attribute.atttypid, target_attribute.atttypmod)
          )
          ELSE 'source."label"::text'
        END
      INTO label_expression
      FROM pg_attribute AS target_attribute
      INNER JOIN pg_type AS target_type
        ON target_type.oid = target_attribute.atttypid
      WHERE target_attribute.attrelid =
          to_regclass('public._projects_v_version_stages')
        AND target_attribute.attname = 'label'
        AND target_attribute.attnum > 0
        AND NOT target_attribute.attisdropped;

      EXECUTE format(
        'INSERT INTO "_projects_v_version_stages"
          ("_order", "_parent_id", "label", "caption_no", "caption_en",
           "image_id", "image_url", "_uuid")
         SELECT
           source."_order",
           version."id",
           %s,
           source."caption_no",
           source."caption_en",
           source."image_id",
           source."image_url",
           source."id"
         FROM "projects_stages" AS source
         INNER JOIN "_projects_v" AS version
           ON version."parent_id" = source."_parent_id"
           AND version."latest" IS TRUE
         WHERE NOT EXISTS (
           SELECT 1
           FROM "_projects_v_version_stages" AS existing
           WHERE existing."_parent_id" = version."id"
             AND existing."_uuid" = source."id"
         )',
        label_expression
      );
    END
    $stage_backfill$;

    INSERT INTO "_products_v_version_badges_no"
      ("_order", "_parent_id", "label", "_uuid")
    SELECT source."_order", version."id", source."label", source."id"
    FROM "products_badges_no" AS source
    INNER JOIN "_products_v" AS version
      ON version."parent_id" = source."_parent_id"
      AND version."latest" IS TRUE
    WHERE NOT EXISTS (
      SELECT 1
      FROM "_products_v_version_badges_no" AS existing
      WHERE existing."_parent_id" = version."id"
        AND existing."_uuid" = source."id"
    );

    INSERT INTO "_products_v_version_badges_en"
      ("_order", "_parent_id", "label", "_uuid")
    SELECT source."_order", version."id", source."label", source."id"
    FROM "products_badges_en" AS source
    INNER JOIN "_products_v" AS version
      ON version."parent_id" = source."_parent_id"
      AND version."latest" IS TRUE
    WHERE NOT EXISTS (
      SELECT 1
      FROM "_products_v_version_badges_en" AS existing
      WHERE existing."_parent_id" = version."id"
        AND existing."_uuid" = source."id"
    );

    INSERT INTO "_site_settings_v_version_nav_items"
      ("_order", "_parent_id", "label_no", "label_en", "href", "visible", "_uuid")
    SELECT
      source."_order",
      version."id",
      source."label_no",
      source."label_en",
      source."href",
      source."visible",
      source."id"
    FROM "site_settings_nav_items" AS source
    CROSS JOIN LATERAL (
      SELECT "id"
      FROM "_site_settings_v"
      WHERE "latest" IS TRUE
      ORDER BY "id" DESC
      LIMIT 1
    ) AS version
    WHERE NOT EXISTS (
      SELECT 1
      FROM "_site_settings_v_version_nav_items" AS existing
      WHERE existing."_parent_id" = version."id"
        AND existing."_uuid" = source."id"
    );

    INSERT INTO "_site_settings_v_version_testimonials_items"
      ("_order", "_parent_id", "quote_no", "quote_en", "author_no",
       "author_en", "service_no", "service_en", "_uuid")
    SELECT
      source."_order",
      version."id",
      source."quote_no",
      source."quote_en",
      source."author_no",
      source."author_en",
      source."service_no",
      source."service_en",
      source."id"
    FROM "site_settings_testimonials_items" AS source
    CROSS JOIN LATERAL (
      SELECT "id"
      FROM "_site_settings_v"
      WHERE "latest" IS TRUE
      ORDER BY "id" DESC
      LIMIT 1
    ) AS version
    WHERE NOT EXISTS (
      SELECT 1
      FROM "_site_settings_v_version_testimonials_items" AS existing
      WHERE existing."_parent_id" = version."id"
        AND existing."_uuid" = source."id"
    );
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_site_settings_v_version_testimonials_items" CASCADE;
    DROP TABLE IF EXISTS "_site_settings_v_version_nav_items" CASCADE;
    DROP TABLE IF EXISTS "_products_v_version_badges_en" CASCADE;
    DROP TABLE IF EXISTS "_products_v_version_badges_no" CASCADE;
    DROP TABLE IF EXISTS "_projects_v_version_stages" CASCADE;

    DROP TABLE IF EXISTS "_site_settings_v" CASCADE;
    DROP TABLE IF EXISTS "_faq_v" CASCADE;
    DROP TABLE IF EXISTS "_products_v" CASCADE;
    DROP TABLE IF EXISTS "_projects_v" CASCADE;
    DROP TABLE IF EXISTS "_services_v" CASCADE;

    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "_status";
    ALTER TABLE "faq" DROP COLUMN IF EXISTS "_status";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "_status";
    ALTER TABLE "projects" DROP COLUMN IF EXISTS "_status";
    ALTER TABLE "services" DROP COLUMN IF EXISTS "_status";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "role";

    DROP TYPE IF EXISTS "enum_site_settings_status";
    DROP TYPE IF EXISTS "enum_faq_status";
    DROP TYPE IF EXISTS "enum_products_status";
    DROP TYPE IF EXISTS "enum_projects_status";
    DROP TYPE IF EXISTS "enum_services_status";
  `);
}
