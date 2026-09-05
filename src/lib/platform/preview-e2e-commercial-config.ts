import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
  type Where,
} from "payload";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import {
  PREVIEW_E2E_NONBINDING_TERMS_REFERENCE,
  previewE2ENonbindingDocumentsEnabled,
} from "./preview-nonbinding-documents";
import { PREVIEW_E2E_ISOLATED_DB_FINGERPRINT } from "./contract-terms-approval";

type Environment = Readonly<Record<string, string | undefined>>;

export { PREVIEW_E2E_ISOLATED_DB_FINGERPRINT };
export const PREVIEW_E2E_PRICE_RULE_REFERENCE =
  "PREVIEW-E2E-TAKVASK-V1";
export const PREVIEW_E2E_BOOTSTRAP_CORRELATION_ID =
  "preview-e2e-commercial-config-v1";

export const previewE2ETerms = {
  version: PREVIEW_E2E_NONBINDING_TERMS_REFERENCE,
  title: "PREVIEW TEST – ikke-bindende testvilkår",
  contractText:
    "PREVIEW TEST – IKKE BINDENDE. Dette dokumentet brukes bare til å kontrollere tilbuds-, signerings- og historikkflyten. Det oppretter ingen bestilling, betalingsplikt, arbeidstillatelse eller kommersiell avtale. Alle priser og ytelser er syntetiske testdata.",
  withdrawalInstructions:
    "PREVIEW TEST – IKKE BINDENDE. Angreinformasjonen vises bare for å kontrollere dokumentlayout og arbeidsflyt. Det finnes ingen reell avtale eller betaling å angre på, og denne testen skal ikke brukes som juridisk dokumentasjon.",
  withdrawalFormUrl: "https://example.invalid/preview-e2e-only",
} as const;

export const previewE2EPriceRule = {
  reference: PREVIEW_E2E_PRICE_RULE_REFERENCE,
  version: 1,
  serviceKey: "takvask" as const,
  unitPriceExVatOre: 12_345,
  vatBasisPoints: 2_500,
  minimumExVatOre: 1_234_500,
  toleranceBasisPoints: 1_000,
  validFrom: "2026-09-01T00:00:00.000Z",
  termsVersion: PREVIEW_E2E_NONBINDING_TERMS_REFERENCE,
  notes:
    "SYNTHETIC PREVIEW E2E VALUE – NOT A COMMERCIAL PRICE. Only for the isolated takvask test path.",
} as const;

export class PreviewE2ECommercialConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreviewE2ECommercialConfigError";
  }
}

export function assertPreviewE2ECommercialBootstrapEnvironment(
  environment: Environment = process.env,
) {
  if (environment.PREVIEW_E2E_BOOTSTRAP !== "isolated-preview-only") {
    throw new PreviewE2ECommercialConfigError(
      "PREVIEW_E2E_BOOTSTRAP must be isolated-preview-only",
    );
  }
  if (!previewE2ENonbindingDocumentsEnabled(environment)) {
    throw new PreviewE2ECommercialConfigError(
      "Preview nonbinding document mode is required",
    );
  }
  const databaseUrl = environment.DATABASE_URL?.trim();
  const expectedHost = environment.PREVIEW_E2E_EXPECTED_DB_HOST?.trim();
  if (!databaseUrl?.startsWith("postgres") || !expectedHost) {
    throw new PreviewE2ECommercialConfigError(
      "An exact isolated Preview PostgreSQL host is required",
    );
  }
  let actualHost: string;
  try {
    actualHost = new URL(databaseUrl).hostname;
  } catch {
    throw new PreviewE2ECommercialConfigError("DATABASE_URL is invalid");
  }
  if (actualHost !== expectedHost) {
    throw new PreviewE2ECommercialConfigError(
      "DATABASE_URL does not match PREVIEW_E2E_EXPECTED_DB_HOST",
    );
  }
  if (!actualHost.includes(PREVIEW_E2E_ISOLATED_DB_FINGERPRINT)) {
    throw new PreviewE2ECommercialConfigError(
      "DATABASE_URL is not the approved isolated Preview database",
    );
  }
  return { databaseHost: actualHost };
}

type StoredRecord = Record<string, unknown> & { id: number };

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value) {
    return Number((value as { id: unknown }).id);
  }
  return undefined;
}

function assertMatchingRecord(
  label: string,
  record: StoredRecord,
  expected: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries(expected)) {
    if (String(record[key] ?? "") !== String(value ?? "")) {
      throw new PreviewE2ECommercialConfigError(
        `${label} reference already exists with different ${key}`,
      );
    }
  }
  if (record.status !== "approved") {
    throw new PreviewE2ECommercialConfigError(
      `${label} reference already exists but is not approved`,
    );
  }
}

async function findOne(
  payload: Payload,
  req: PayloadRequest,
  collection: "contract-terms" | "price-rules" | "audit-events",
  where: Where,
) {
  const result = await payload.find({
    collection,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where,
  });
  return result.docs[0] as unknown as StoredRecord | undefined;
}

async function ensureTerms(
  payload: Payload,
  req: PayloadRequest,
) {
  const existing = await findOne(payload, req, "contract-terms", {
    version: { equals: previewE2ETerms.version },
  });
  if (existing) {
    assertMatchingRecord("Contract terms", existing, {
      ...previewE2ETerms,
      legalReviewReference: PREVIEW_E2E_NONBINDING_TERMS_REFERENCE,
    });
    return existing;
  }
  const draft = await payload.create({
    collection: "contract-terms",
    overrideAccess: true,
    req,
    data: { ...previewE2ETerms, status: "draft" },
  });
  return payload.update({
    collection: "contract-terms",
    id: draft.id,
    overrideAccess: true,
    req,
    data: { status: "approved" },
  });
}

async function ensurePriceRule(
  payload: Payload,
  req: PayloadRequest,
) {
  const existing = await findOne(payload, req, "price-rules", {
    reference: { equals: previewE2EPriceRule.reference },
  });
  if (existing) {
    assertMatchingRecord("Price rule", existing, previewE2EPriceRule);
    return existing;
  }
  const draft = await payload.create({
    collection: "price-rules",
    overrideAccess: true,
    req,
    data: { ...previewE2EPriceRule, status: "draft" },
  });
  return payload.update({
    collection: "price-rules",
    id: draft.id,
    overrideAccess: true,
    req,
    data: { status: "approved" },
  });
}

async function transactionRequest(payload: Payload, administrator: StoredRecord) {
  const req = { payload, user: administrator } as unknown as PayloadRequest;
  if (!(await initTransaction(req))) {
    throw new PreviewE2ECommercialConfigError(
      "The commercial bootstrap requires a database transaction",
    );
  }
  return req;
}

export async function ensurePreviewE2ECommercialConfig(input: {
  payload: Payload;
  administrator: StoredRecord;
  environment?: Environment;
}) {
  assertPreviewE2ECommercialBootstrapEnvironment(input.environment);
  const req = await transactionRequest(input.payload, input.administrator);
  let committed = false;
  try {
    const terms = await ensureTerms(input.payload, req);
    const priceRule = await ensurePriceRule(input.payload, req);
    const previousAudit = await findOne(input.payload, req, "audit-events", {
      correlationId: { equals: PREVIEW_E2E_BOOTSTRAP_CORRELATION_ID },
    });
    if (!previousAudit) {
      await recordAuditEvent(createPayloadAuditWriter(input.payload, { req }), {
        actorId: relationId(input.administrator),
        action: "preview-e2e.commercial-config-ready",
        entityType: "preview-e2e-bootstrap",
        entityId: "commercial-v1",
        correlationId: PREVIEW_E2E_BOOTSTRAP_CORRELATION_ID,
        changedFields: ["contractTerms", "priceRule"],
        after: {
          termsId: terms.id,
          priceRuleId: priceRule.id,
          nonbinding: true,
        },
        metadata: {
          termsVersion: previewE2ETerms.version,
          priceRuleReference: previewE2EPriceRule.reference,
          nonbinding: true,
        },
      });
    }
    await commitTransaction(req);
    committed = true;
    return {
      status: previousAudit ? "already_ready" : "ready",
      terms: { id: terms.id, version: terms.version, status: terms.status },
      priceRule: {
        id: priceRule.id,
        reference: priceRule.reference,
        status: priceRule.status,
      },
    } as const;
  } finally {
    if (!committed) await killTransaction(req);
  }
}

export async function retirePreviewE2ECommercialConfig(input: {
  payload: Payload;
  administrator: StoredRecord;
  environment?: Environment;
}) {
  assertPreviewE2ECommercialBootstrapEnvironment(input.environment);
  const req = await transactionRequest(input.payload, input.administrator);
  let committed = false;
  try {
    const terms = await findOne(input.payload, req, "contract-terms", {
      version: { equals: previewE2ETerms.version },
    });
    const priceRule = await findOne(input.payload, req, "price-rules", {
      reference: { equals: previewE2EPriceRule.reference },
    });
    const retired: Array<"contractTerms" | "priceRule"> = [];
    const before: Record<string, string> = {};
    const after: Record<string, string> = {};
    if (terms?.status === "approved") {
      await input.payload.update({
        collection: "contract-terms",
        id: terms.id,
        overrideAccess: true,
        req,
        data: { status: "retired" },
      });
      retired.push("contractTerms");
      before.contractTermsStatus = "approved";
      after.contractTermsStatus = "retired";
    }
    if (priceRule?.status === "approved") {
      await input.payload.update({
        collection: "price-rules",
        id: priceRule.id,
        overrideAccess: true,
        req,
        data: { status: "retired" },
      });
      retired.push("priceRule");
      before.priceRuleStatus = "approved";
      after.priceRuleStatus = "retired";
    }
    if (retired.length === 0) {
      await commitTransaction(req);
      committed = true;
      return {
        status: terms || priceRule ? "already_retired" : "absent",
        retired,
      } as const;
    }
    await recordAuditEvent(createPayloadAuditWriter(input.payload, { req }), {
      actorId: relationId(input.administrator),
      action: "preview-e2e.commercial-config-retired",
      entityType: "preview-e2e-bootstrap",
      entityId: "commercial-v1",
      correlationId: `${PREVIEW_E2E_BOOTSTRAP_CORRELATION_ID}-retired`,
      changedFields: retired.map((target) => `${target}.status`),
      before,
      after,
      metadata: { nonbinding: true },
    });
    await commitTransaction(req);
    committed = true;
    return { status: "retired", retired } as const;
  } finally {
    if (!committed) await killTransaction(req);
  }
}
