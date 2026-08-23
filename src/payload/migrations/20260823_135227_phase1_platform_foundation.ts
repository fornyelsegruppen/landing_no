import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

/**
 * Additive platform-foundation migration.
 *
 * The generator initially included historical schema changes because older
 * migrations did not carry current JSON snapshots. The JSON file beside this
 * migration is now the canonical snapshot, while this SQL intentionally
 * contains only the new phase-one tables and lock relations.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_operational_jobs_status" AS ENUM(
        'pending', 'running', 'retry', 'completed', 'failed', 'attention', 'cancelled'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_private_media_classification" AS ENUM(
        'customer', 'measurement', 'contract', 'work'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "audit_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "actor_id" integer,
      "action" varchar NOT NULL,
      "entity_type" varchar NOT NULL,
      "entity_id" varchar NOT NULL,
      "correlation_id" varchar NOT NULL,
      "changed_fields" jsonb,
      "before_hash" varchar,
      "after_hash" varchar,
      "metadata" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "operational_jobs" (
      "id" serial PRIMARY KEY NOT NULL,
      "type" varchar NOT NULL,
      "status" "enum_operational_jobs_status" DEFAULT 'pending' NOT NULL,
      "idempotency_key" varchar NOT NULL,
      "correlation_id" varchar NOT NULL,
      "attempts" numeric DEFAULT 0 NOT NULL,
      "max_attempts" numeric DEFAULT 3 NOT NULL,
      "available_at" timestamp(3) with time zone NOT NULL,
      "started_at" timestamp(3) with time zone,
      "completed_at" timestamp(3) with time zone,
      "last_error_code" varchar,
      "last_error_message" varchar,
      "payload" jsonb,
      "result" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "access_tokens" (
      "id" serial PRIMARY KEY NOT NULL,
      "purpose" varchar NOT NULL,
      "token_hash" varchar NOT NULL,
      "subject_type" varchar NOT NULL,
      "subject_id" varchar NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "revoked_at" timestamp(3) with time zone,
      "used_at" timestamp(3) with time zone,
      "single_use" boolean DEFAULT false,
      "metadata" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "private_media" (
      "id" serial PRIMARY KEY NOT NULL,
      "classification" "enum_private_media_classification" DEFAULT 'customer' NOT NULL,
      "owner_type" varchar,
      "owner_id" varchar,
      "alt" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "url" varchar,
      "thumbnail_u_r_l" varchar,
      "filename" varchar,
      "mime_type" varchar,
      "filesize" numeric,
      "width" numeric,
      "height" numeric,
      "focal_x" numeric,
      "focal_y" numeric
    );

    ALTER TABLE IF EXISTS "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "audit_events_id" integer,
      ADD COLUMN IF NOT EXISTS "operational_jobs_id" integer,
      ADD COLUMN IF NOT EXISTS "access_tokens_id" integer,
      ADD COLUMN IF NOT EXISTS "private_media_id" integer;

    DO $$ BEGIN
      IF to_regclass('public.users') IS NOT NULL THEN
        ALTER TABLE "audit_events"
          ADD CONSTRAINT "audit_events_actor_id_users_id_fk"
          FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      IF to_regclass('public.payload_locked_documents_rels') IS NOT NULL THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_audit_events_fk"
          FOREIGN KEY ("audit_events_id") REFERENCES "public"."audit_events"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      IF to_regclass('public.payload_locked_documents_rels') IS NOT NULL THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_operational_jobs_fk"
          FOREIGN KEY ("operational_jobs_id") REFERENCES "public"."operational_jobs"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      IF to_regclass('public.payload_locked_documents_rels') IS NOT NULL THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_access_tokens_fk"
          FOREIGN KEY ("access_tokens_id") REFERENCES "public"."access_tokens"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      IF to_regclass('public.payload_locked_documents_rels') IS NOT NULL THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_private_media_fk"
          FOREIGN KEY ("private_media_id") REFERENCES "public"."private_media"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "audit_events_actor_idx" ON "audit_events" ("actor_id");
    CREATE INDEX IF NOT EXISTS "audit_events_action_idx" ON "audit_events" ("action");
    CREATE INDEX IF NOT EXISTS "audit_events_entity_type_idx" ON "audit_events" ("entity_type");
    CREATE INDEX IF NOT EXISTS "audit_events_entity_id_idx" ON "audit_events" ("entity_id");
    CREATE INDEX IF NOT EXISTS "audit_events_correlation_id_idx" ON "audit_events" ("correlation_id");
    CREATE INDEX IF NOT EXISTS "audit_events_updated_at_idx" ON "audit_events" ("updated_at");
    CREATE INDEX IF NOT EXISTS "audit_events_created_at_idx" ON "audit_events" ("created_at");

    CREATE INDEX IF NOT EXISTS "operational_jobs_type_idx" ON "operational_jobs" ("type");
    CREATE INDEX IF NOT EXISTS "operational_jobs_status_idx" ON "operational_jobs" ("status");
    CREATE UNIQUE INDEX IF NOT EXISTS "operational_jobs_idempotency_key_idx" ON "operational_jobs" ("idempotency_key");
    CREATE INDEX IF NOT EXISTS "operational_jobs_correlation_id_idx" ON "operational_jobs" ("correlation_id");
    CREATE INDEX IF NOT EXISTS "operational_jobs_available_at_idx" ON "operational_jobs" ("available_at");
    CREATE INDEX IF NOT EXISTS "operational_jobs_updated_at_idx" ON "operational_jobs" ("updated_at");
    CREATE INDEX IF NOT EXISTS "operational_jobs_created_at_idx" ON "operational_jobs" ("created_at");

    CREATE INDEX IF NOT EXISTS "access_tokens_purpose_idx" ON "access_tokens" ("purpose");
    CREATE UNIQUE INDEX IF NOT EXISTS "access_tokens_token_hash_idx" ON "access_tokens" ("token_hash");
    CREATE INDEX IF NOT EXISTS "access_tokens_subject_type_idx" ON "access_tokens" ("subject_type");
    CREATE INDEX IF NOT EXISTS "access_tokens_subject_id_idx" ON "access_tokens" ("subject_id");
    CREATE INDEX IF NOT EXISTS "access_tokens_expires_at_idx" ON "access_tokens" ("expires_at");
    CREATE INDEX IF NOT EXISTS "access_tokens_revoked_at_idx" ON "access_tokens" ("revoked_at");
    CREATE INDEX IF NOT EXISTS "access_tokens_updated_at_idx" ON "access_tokens" ("updated_at");
    CREATE INDEX IF NOT EXISTS "access_tokens_created_at_idx" ON "access_tokens" ("created_at");

    CREATE INDEX IF NOT EXISTS "private_media_classification_idx" ON "private_media" ("classification");
    CREATE INDEX IF NOT EXISTS "private_media_owner_type_idx" ON "private_media" ("owner_type");
    CREATE INDEX IF NOT EXISTS "private_media_owner_id_idx" ON "private_media" ("owner_id");
    CREATE INDEX IF NOT EXISTS "private_media_updated_at_idx" ON "private_media" ("updated_at");
    CREATE INDEX IF NOT EXISTS "private_media_created_at_idx" ON "private_media" ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "private_media_filename_idx" ON "private_media" ("filename");

    DO $$ BEGIN
      IF to_regclass('public.payload_locked_documents_rels') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_audit_events_id_idx"
          ON "payload_locked_documents_rels" ("audit_events_id");
        CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_operational_jobs_id_idx"
          ON "payload_locked_documents_rels" ("operational_jobs_id");
        CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_access_tokens_id_idx"
          ON "payload_locked_documents_rels" ("access_tokens_id");
        CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_private_media_id_idx"
          ON "payload_locked_documents_rels" ("private_media_id");
      END IF;
    END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE IF EXISTS "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "audit_events_id",
      DROP COLUMN IF EXISTS "operational_jobs_id",
      DROP COLUMN IF EXISTS "access_tokens_id",
      DROP COLUMN IF EXISTS "private_media_id";

    DROP TABLE IF EXISTS "private_media" CASCADE;
    DROP TABLE IF EXISTS "access_tokens" CASCADE;
    DROP TABLE IF EXISTS "operational_jobs" CASCADE;
    DROP TABLE IF EXISTS "audit_events" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_private_media_classification";
    DROP TYPE IF EXISTS "public"."enum_operational_jobs_status";
  `);
}
