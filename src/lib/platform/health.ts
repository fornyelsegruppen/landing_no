import {
  featureFlagNames,
  featureReadiness,
  readFeatureFlags,
  readIntegrationStatus,
  type Environment,
} from "./features";
import type { Payload } from "payload";

export type PlatformHealth = ReturnType<typeof buildPlatformHealth>;

export type OperationalHealth = {
  backup: { lastVerifiedAt?: string; referenceConfigured: boolean };
  email: { failed: number; lastDeliveredAt?: string };
  jobs: { failed: number; lastCompletedAt?: string; overdue: number; quotaWarnings: number };
  seo: { failed: number; lastCompletedAt?: string };
};

function record(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function dateValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function firstDate(result: { docs: unknown[] }, ...fields: string[]) {
  const item = record(result.docs[0]);
  return fields.map((field) => dateValue(item[field])).find(Boolean);
}

/**
 * Builds an administrator-safe configuration summary. It deliberately returns
 * environment variable names that are missing, never configured values.
 */
export function buildPlatformHealth(environment: Environment = process.env) {
  const flags = readFeatureFlags(environment);
  const integrations = readIntegrationStatus(environment);

  return {
    generatedAt: new Date().toISOString(),
    features: Object.fromEntries(
      featureFlagNames.map((name) => [
        name,
        {
          ...featureReadiness(name, environment),
          enabled: flags[name],
        },
      ]),
    ),
    integrations,
  };
}

/** Loads safe operational evidence without returning payloads or provider IDs. */
export async function loadOperationalHealth(
  payload: Pick<Payload, "count" | "find">,
  now = new Date(),
  environment: Environment = process.env,
): Promise<OperationalHealth> {
  const latest = { depth: 0, limit: 1, overrideAccess: true, pagination: false } as const;
  const [failedJobs, overdueJobs, quotaJobs, completedJobs, failedEmail, deliveredEmail, failedSeo, completedSeo] = await Promise.all([
    payload.count({ collection: "operational-jobs", where: { status: { in: ["failed", "attention"] } } }),
    payload.count({ collection: "operational-jobs", where: { and: [{ status: { in: ["pending", "retry"] } }, { availableAt: { less_than_equal: now.toISOString() } }] } }),
    payload.count({ collection: "operational-jobs", where: { or: [{ lastErrorCode: { contains: "quota" } }, { lastErrorCode: { contains: "rate_limit" } }] } }),
    payload.find({ ...latest, collection: "operational-jobs", sort: "-completedAt", where: { status: { equals: "completed" } } }),
    payload.count({ collection: "messages", where: { status: { in: ["failed", "attention"] } } }),
    payload.find({ ...latest, collection: "messages", sort: "-deliveredAt", where: { status: { equals: "delivered" } } }),
    payload.count({ collection: "seo-runs", where: { status: { in: ["failed", "attention"] } } }),
    payload.find({ ...latest, collection: "seo-runs", sort: "-finishedAt", where: { status: { equals: "completed" } } }),
  ]);

  return {
    backup: {
      lastVerifiedAt: dateValue(environment.BACKUP_LAST_VERIFIED_AT),
      referenceConfigured: Boolean(environment.RESTORE_TEST_REFERENCE?.trim()),
    },
    email: {
      failed: failedEmail.totalDocs,
      lastDeliveredAt: firstDate(deliveredEmail, "deliveredAt", "sentAt", "updatedAt"),
    },
    jobs: {
      failed: failedJobs.totalDocs,
      lastCompletedAt: firstDate(completedJobs, "completedAt", "updatedAt"),
      overdue: overdueJobs.totalDocs,
      quotaWarnings: quotaJobs.totalDocs,
    },
    seo: {
      failed: failedSeo.totalDocs,
      lastCompletedAt: firstDate(completedSeo, "finishedAt", "updatedAt"),
    },
  };
}
