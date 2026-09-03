import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
  type Where,
} from "payload";
import type { RoofFusionWorkbenchDraft } from "@/payload/payload-types";
import {
  parseRoofFusionWorkbenchDraftV1,
  type RoofFusionWorkbenchDraftReferenceV1,
  type RoofFusionWorkbenchDraftV1,
} from "./workbench-draft-contract-v1";

export type WorkbenchDraftExpectedLatestV1 = RoofFusionWorkbenchDraftReferenceV1 | null;

export class RoofFusionWorkbenchDraftRepositoryError extends Error {
  constructor(
    readonly code:
      | "CASE_MISMATCH"
      | "EXPECTED_REVISION_MISMATCH"
      | "STALE_DRAFT_HASH"
      | "DRAFT_ID_CONFLICT"
      | "IDEMPOTENCY_CONFLICT"
      | "REPOSITORY_INTEGRITY",
    message: string,
  ) {
    super(message);
    this.name = "RoofFusionWorkbenchDraftRepositoryError";
  }
}

export interface RoofFusionWorkbenchDraftRepositoryV1 {
  readDraft(caseId: string, draftId: string): Promise<RoofFusionWorkbenchDraftV1 | null>;
  readLatestDraft(caseId: string): Promise<RoofFusionWorkbenchDraftV1 | null>;
  readByIdempotency(caseId: string, idempotencyKey: string): Promise<RoofFusionWorkbenchDraftV1 | null>;
  appendAtomically(input: {
    expectedLatest: WorkbenchDraftExpectedLatestV1;
    draft: RoofFusionWorkbenchDraftV1;
  }): Promise<"applied" | "replayed">;
}

function assertExpected(
  latest: RoofFusionWorkbenchDraftV1 | null,
  expected: WorkbenchDraftExpectedLatestV1,
) {
  if ((latest === null) !== (expected === null)) {
    throw new RoofFusionWorkbenchDraftRepositoryError(
      "EXPECTED_REVISION_MISMATCH",
      "Latest workbench draft changed before append",
    );
  }
  if (
    latest &&
    expected &&
    (latest.draftId !== expected.draftId ||
      latest.revision !== expected.revision ||
      latest.draftHash !== expected.draftHash)
  ) {
    throw new RoofFusionWorkbenchDraftRepositoryError(
      latest.draftHash !== expected.draftHash ? "STALE_DRAFT_HASH" : "EXPECTED_REVISION_MISMATCH",
      "Latest workbench draft changed before append",
    );
  }
}

function assertLineage(latest: RoofFusionWorkbenchDraftV1 | null, draft: RoofFusionWorkbenchDraftV1) {
  if (draft.revision !== (latest ? latest.revision + 1 : 1)) {
    throw new RoofFusionWorkbenchDraftRepositoryError(
      "EXPECTED_REVISION_MISMATCH",
      "Workbench draft revision must be consecutive",
    );
  }
  if ((draft.supersedesDraftId ?? null) !== (latest?.draftId ?? null)) {
    throw new RoofFusionWorkbenchDraftRepositoryError(
      "REPOSITORY_INTEGRITY",
      "Workbench draft lineage does not reference the latest draft",
    );
  }
}

export class InMemoryRoofFusionWorkbenchDraftRepositoryV1 implements RoofFusionWorkbenchDraftRepositoryV1 {
  private readonly drafts = new Map<string, RoofFusionWorkbenchDraftV1[]>();

  async readDraft(caseId: string, draftId: string) {
    return (this.drafts.get(caseId) ?? []).find((draft) => draft.draftId === draftId) ?? null;
  }

  async readLatestDraft(caseId: string) {
    const drafts = this.drafts.get(caseId) ?? [];
    return drafts.at(-1) ?? null;
  }

  async readByIdempotency(caseId: string, idempotencyKey: string) {
    return (this.drafts.get(caseId) ?? []).find((draft) => draft.idempotencyKey === idempotencyKey) ?? null;
  }

  async appendAtomically({ expectedLatest, draft }: { expectedLatest: WorkbenchDraftExpectedLatestV1; draft: RoofFusionWorkbenchDraftV1 }) {
    const parsed = parseRoofFusionWorkbenchDraftV1(draft);
    const latest = await this.readLatestDraft(parsed.caseId);
    const replay = await this.readByIdempotency(parsed.caseId, parsed.idempotencyKey);
    if (replay) {
      if (replay.draftHash !== parsed.draftHash) {
        throw new RoofFusionWorkbenchDraftRepositoryError("IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different draft");
      }
      return "replayed";
    }
    assertExpected(latest, expectedLatest);
    assertLineage(latest, parsed);
    const ids = this.drafts.get(parsed.caseId) ?? [];
    if (ids.some((item) => item.draftId === parsed.draftId)) {
      throw new RoofFusionWorkbenchDraftRepositoryError("DRAFT_ID_CONFLICT", "Workbench draft ID already exists");
    }
    this.drafts.set(parsed.caseId, [...ids, structuredClone(parsed)]);
    return "applied";
  }
}

type TransactionRequest = Partial<PayloadRequest> & { payload: Payload };

function parseStoredDraft(row: RoofFusionWorkbenchDraft): RoofFusionWorkbenchDraftV1 {
  let draft: RoofFusionWorkbenchDraftV1;
  try {
    draft = parseRoofFusionWorkbenchDraftV1(row.draft);
  } catch (error) {
    throw new RoofFusionWorkbenchDraftRepositoryError(
      "REPOSITORY_INTEGRITY",
      `Stored workbench draft failed contract validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    row.draftId !== draft.draftId ||
    row.caseId !== draft.caseId ||
    row.caseRevisionKey !== `${draft.caseId}:${draft.revision}` ||
    row.revision !== draft.revision ||
    (row.supersedesDraftId ?? undefined) !== draft.supersedesDraftId ||
    row.draftHash !== draft.draftHash ||
    row.idempotencyKey !== draft.idempotencyKey ||
    row.state !== draft.state ||
    row.sourceContentHash !== draft.source.sourceContentHash
  ) {
    throw new RoofFusionWorkbenchDraftRepositoryError(
      "REPOSITORY_INTEGRITY",
      "Stored workbench draft indexes disagree with the authoritative JSON",
    );
  }
  return draft;
}

export class PayloadRoofFusionWorkbenchDraftRepositoryV1 implements RoofFusionWorkbenchDraftRepositoryV1 {
  constructor(private readonly payload: Payload) {}

  private async find(where: Where, options: { sort?: string; req?: TransactionRequest } = {}) {
    const result = await this.payload.find({
      collection: "roof-fusion-workbench-drafts",
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      where,
      ...(options.sort ? { sort: options.sort } : {}),
      ...(options.req ? { req: options.req as PayloadRequest } : {}),
    });
    const row = result.docs[0] as RoofFusionWorkbenchDraft | undefined;
    return row ? parseStoredDraft(row) : null;
  }

  private readDraftWithRequest(caseId: string, draftId: string, req?: TransactionRequest) {
    return this.find({ and: [{ caseId: { equals: caseId } }, { draftId: { equals: draftId } }] }, req ? { req } : {});
  }

  readDraft(caseId: string, draftId: string) {
    return this.readDraftWithRequest(caseId, draftId);
  }

  private readLatestWithRequest(caseId: string, req?: TransactionRequest) {
    return this.find({ caseId: { equals: caseId } }, { sort: "-revision", ...(req ? { req } : {}) });
  }

  readLatestDraft(caseId: string) {
    return this.readLatestWithRequest(caseId);
  }

  private readByIdempotencyWithRequest(caseId: string, idempotencyKey: string, req?: TransactionRequest) {
    return this.find({ and: [{ caseId: { equals: caseId } }, { idempotencyKey: { equals: idempotencyKey } }] }, req ? { req } : {});
  }

  readByIdempotency(caseId: string, idempotencyKey: string) {
    return this.readByIdempotencyWithRequest(caseId, idempotencyKey);
  }

  async appendAtomically({ expectedLatest, draft }: { expectedLatest: WorkbenchDraftExpectedLatestV1; draft: RoofFusionWorkbenchDraftV1 }) {
    const parsed = parseRoofFusionWorkbenchDraftV1(draft);
    const request = { payload: this.payload } as TransactionRequest;
    const started = await initTransaction(request);
    if (!started) throw new RoofFusionWorkbenchDraftRepositoryError("REPOSITORY_INTEGRITY", "Workbench draft append requires an independently owned transaction");
    let committed = false;
    try {
      const latest = await this.readLatestWithRequest(parsed.caseId, request);
      const replay = await this.readByIdempotencyWithRequest(parsed.caseId, parsed.idempotencyKey, request);
      if (replay) {
        if (replay.draftHash !== parsed.draftHash) throw new RoofFusionWorkbenchDraftRepositoryError("IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different draft");
        await commitTransaction(request);
        committed = true;
        return "replayed";
      }
      assertExpected(latest, expectedLatest);
      assertLineage(latest, parsed);
      if (await this.readDraftWithRequest(parsed.caseId, parsed.draftId, request)) throw new RoofFusionWorkbenchDraftRepositoryError("DRAFT_ID_CONFLICT", "Workbench draft ID already exists");
      await this.payload.create({
        collection: "roof-fusion-workbench-drafts",
        context: { trustedRoofFusionWorkbenchDraftAppend: true },
        overrideAccess: true,
        data: {
          draftId: parsed.draftId,
          caseId: parsed.caseId,
          caseRevisionKey: `${parsed.caseId}:${parsed.revision}`,
          revision: parsed.revision,
          ...(parsed.supersedesDraftId ? { supersedesDraftId: parsed.supersedesDraftId } : {}),
          draftHash: parsed.draftHash,
          idempotencyKey: parsed.idempotencyKey,
          state: parsed.state,
          sourceContentHash: parsed.source.sourceContentHash,
          draft: structuredClone(parsed),
        },
        depth: 0,
        req: request as PayloadRequest,
      });
      await commitTransaction(request);
      committed = true;
      return "applied";
    } catch (error) {
      if (!committed) await killTransaction(request);
      throw error;
    }
  }
}
