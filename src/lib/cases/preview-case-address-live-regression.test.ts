import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Payload, Where } from "payload";
import {
  executePreviewCaseAddressCommand,
  PREVIEW_CASE_ADDRESS_COMMAND_VERSION,
  PreviewCaseAddressCommandError,
  type PreviewCaseAddressCommand,
} from "./preview-case-address-command";

const liveOptIn =
  process.env.LIVE_PREVIEW_CAS_REGRESSION === "isolated-preview-only";
const approvedIsolatedHostFingerprint = "ancient-band-aujp1u5u";

type RelevantState = {
  auditEvents: unknown[];
  contracts: unknown[];
  history: unknown[];
  lead: unknown;
  messages: unknown[];
  quotes: unknown[];
  rfSnapshots: unknown[];
  workbenchDrafts: unknown[];
};

function numericEnvironment(name: string) {
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

async function allDocs(
  payload: Payload,
  collection:
    | "audit-events"
    | "case-address-revisions"
    | "contracts"
    | "messages"
    | "quotes"
    | "roof-fusion-snapshots"
    | "roof-fusion-workbench-drafts",
  where: Where,
) {
  const result = await payload.find({
    collection,
    depth: 0,
    limit: 500,
    overrideAccess: true,
    pagination: false,
    sort: "id",
    where,
  });
  return structuredClone(result.docs);
}

async function relevantState(
  payload: Payload,
  leadId: number,
): Promise<RelevantState> {
  const quotes = await allDocs(payload, "quotes", {
    lead: { equals: leadId },
  });
  const quoteIds = quotes.map((row) => Number((row as { id: unknown }).id));
  const contracts = quoteIds.length
    ? await allDocs(payload, "contracts", {
        or: quoteIds.map((id) => ({ quote: { equals: id } })),
      })
    : [];
  return {
    auditEvents: await allDocs(payload, "audit-events", {
      and: [
        { entityType: { equals: "lead" } },
        { entityId: { equals: String(leadId) } },
      ],
    }),
    contracts,
    history: await allDocs(payload, "case-address-revisions", {
      caseId: { equals: `lead:${leadId}` },
    }),
    lead: structuredClone(
      await payload.findByID({
        collection: "leads",
        id: leadId,
        depth: 0,
        overrideAccess: true,
      }),
    ),
    messages: await allDocs(payload, "messages", {
      lead: { equals: leadId },
    }),
    quotes,
    rfSnapshots: await allDocs(payload, "roof-fusion-snapshots", {
      caseId: { equals: `lead:${leadId}` },
    }),
    workbenchDrafts: await allDocs(payload, "roof-fusion-workbench-drafts", {
      caseId: { equals: `lead:${leadId}` },
    }),
  } satisfies RelevantState;
}

function storedAddress(lead: Record<string, unknown>) {
  return {
    street: String(lead.address || ""),
    houseNumber: typeof lead.houseNumber === "string" ? lead.houseNumber : null,
    postalCode: String(lead.postal || ""),
    city: typeof lead.city === "string" ? lead.city : null,
  };
}

function failAuditAppend(payload: Payload) {
  return new Proxy(payload, {
    get(target, property, receiver) {
      if (property === "create") {
        return async (input: Parameters<Payload["create"]>[0]) => {
          if (input.collection === "audit-events") {
            throw new Error("synthetic downstream audit append failure");
          }
          return target.create(input);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe
  .skipIf(!liveOptIn)
  .sequential(
    "Preview address CAS against an explicitly isolated live database",
    () => {
      let payload: Payload;
      let leadId: number;
      let actorId: number;
      const runId = `cas-${Date.now().toString(36)}`;
      const environment = {
        VERCEL_ENV: "preview",
        FEATURE_ADMIN_NEXT_CASE_ADDRESS_COMMAND: "true",
      } as const;

      beforeAll(async () => {
        const databaseUrl = process.env.PREVIEW_CAS_DATABASE_URL;
        const expectedHost = process.env.PREVIEW_CAS_EXPECTED_DB_HOST;
        if (!databaseUrl || !expectedHost) {
          throw new Error(
            "PREVIEW_CAS_DATABASE_URL and PREVIEW_CAS_EXPECTED_DB_HOST are required",
          );
        }
        const actualHost = new URL(databaseUrl).hostname;
        if (actualHost !== expectedHost) {
          throw new Error(
            `Refusing mutation: database host ${actualHost} does not match ${expectedHost}`,
          );
        }
        if (!actualHost.includes(approvedIsolatedHostFingerprint)) {
          throw new Error(
            `Refusing mutation: ${actualHost} is not the approved isolated Preview database`,
          );
        }
        if (process.env.VERCEL_ENV === "production") {
          throw new Error("Refusing mutation while VERCEL_ENV=production");
        }
        leadId = numericEnvironment("PREVIEW_CAS_TEST_LEAD_ID");
        actorId = numericEnvironment("PREVIEW_CAS_TEST_ACTOR_ID");
        vi.stubEnv("DATABASE_URL", databaseUrl);
        // The schema is already migrated. Production mode keeps Payload's
        // development schema push disabled during this mutation-only check.
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PAYLOAD_SECRET", "isolated-preview-cas-regression-secret");
        vi.stubEnv("VERCEL_ENV", "preview");
        vi.stubEnv("FEATURE_ADMIN_NEXT_CASE_ADDRESS_COMMAND", "true");
        vi.stubEnv("FEATURE_CASE_STATE_ENGINE_V2", "true");
        vi.stubEnv("FEATURE_ROOF_FUSION_V1", "true");
        vi.resetModules();
        const [{ getPayload }, { default: config }] = await Promise.all([
          import("payload"),
          import("@/payload.config"),
        ]);
        payload = await getPayload({ config });
        await payload.findByID({
          collection: "users",
          id: actorId,
          depth: 0,
          overrideAccess: true,
        });
        await payload.findByID({
          collection: "leads",
          id: leadId,
          depth: 0,
          overrideAccess: true,
        });
      }, 60_000);

      afterAll(async () => {
        await payload?.destroy();
        vi.unstubAllEnvs();
      });

      function command(
        lead: Record<string, unknown>,
        suffix: string,
        street: string,
      ): PreviewCaseAddressCommand {
        return {
          schemaVersion: PREVIEW_CASE_ADDRESS_COMMAND_VERSION,
          leadId,
          expectedCaseRevision: Number(lead.caseRevision || 1),
          expectedAddressRevision: Number(lead.addressRevision || 1),
          idempotencyKey: `${runId}-${suffix}`,
          correlationId: `${runId}-${suffix}`,
          actorId,
          reasonCode: "data_quality_recovery",
          address: { ...storedAddress(lead), street },
        };
      }

      it("applies once, replays identically, and creates no customer message", async () => {
        const before = await relevantState(payload, leadId);
        const lead = before.lead as Record<string, unknown>;
        const input = command(lead, "legal", `CAS ${runId} legal`);

        const applied = await executePreviewCaseAddressCommand({
          payload,
          command: input,
          environment,
        });
        expect(applied.status).toBe("applied");

        const afterApplied = await relevantState(payload, leadId);
        expect(afterApplied.history).toHaveLength(before.history.length + 1);
        expect(afterApplied.auditEvents).toHaveLength(
          before.auditEvents.length + 1,
        );
        expect(afterApplied.messages).toEqual(before.messages);
        expect(afterApplied.lead).toMatchObject({
          address: input.address.street,
          caseRevision: input.expectedCaseRevision + 1,
          addressRevision: input.expectedAddressRevision + 1,
        });

        const replayed = await executePreviewCaseAddressCommand({
          payload,
          command: { ...input, correlationId: `${runId}-legal-retry` },
          environment,
        });
        expect(replayed).toEqual({ ...applied, status: "replayed" });
        expect(await relevantState(payload, leadId)).toEqual(afterApplied);
      }, 60_000);

      it("allows only one concurrent winner and leaves a later stale failure atomic", async () => {
        const beforeRace = await relevantState(payload, leadId);
        const lead = beforeRace.lead as Record<string, unknown>;
        const left = command(lead, "race-left", `CAS ${runId} left`);
        const right = command(lead, "race-right", `CAS ${runId} right`);
        const outcomes = await Promise.allSettled([
          executePreviewCaseAddressCommand({
            payload,
            command: left,
            environment,
          }),
          executePreviewCaseAddressCommand({
            payload,
            command: right,
            environment,
          }),
        ]);
        const fulfilled = outcomes.filter(
          (outcome) => outcome.status === "fulfilled",
        );
        const rejected = outcomes.filter(
          (outcome) => outcome.status === "rejected",
        );
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0]?.reason).toBeInstanceOf(
          PreviewCaseAddressCommandError,
        );
        expect([
          "CASE_REVISION_CONFLICT",
          "ADDRESS_REVISION_CONFLICT",
        ]).toContain(
          (rejected[0]?.reason as PreviewCaseAddressCommandError).code,
        );

        const afterRace = await relevantState(payload, leadId);
        expect(afterRace.history).toHaveLength(beforeRace.history.length + 1);
        expect(afterRace.auditEvents).toHaveLength(
          beforeRace.auditEvents.length + 1,
        );
        expect(afterRace.messages).toEqual(beforeRace.messages);

        const winningLead = afterRace.lead as Record<string, unknown>;
        const stale = command(
          {
            ...winningLead,
            caseRevision: Number(winningLead.caseRevision) - 1,
            addressRevision: Number(winningLead.addressRevision) - 1,
          },
          "stale",
          `CAS ${runId} stale`,
        );
        await expect(
          executePreviewCaseAddressCommand({
            payload,
            command: stale,
            environment,
          }),
        ).rejects.toMatchObject({ code: "CASE_REVISION_CONFLICT" });
        expect(await relevantState(payload, leadId)).toEqual(afterRace);
      }, 60_000);

      it("rolls back the lead, RF drafts, commercial drafts and history after a downstream failure", async () => {
        const beforeFailure = await relevantState(payload, leadId);
        const lead = beforeFailure.lead as Record<string, unknown>;
        const input = command(lead, "forced-rollback", `CAS ${runId} rollback`);

        await expect(
          executePreviewCaseAddressCommand({
            payload: failAuditAppend(payload),
            command: input,
            environment,
          }),
        ).rejects.toMatchObject({ code: "REPOSITORY_INTEGRITY" });

        expect(await relevantState(payload, leadId)).toEqual(beforeFailure);
      }, 60_000);
    },
  );
