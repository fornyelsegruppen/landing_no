import { describe, expect, it, vi } from "vitest";
import { parseRoofFusionWorkbenchDraftV1 } from "./workbench-draft-contract-v1";
import {
  buildWorkbenchDraftFromUiV1,
  constrainWorkbenchPointToOutlineV1,
  loadWorkbenchDraftRecoveryV1,
  loadWorkbenchDraftV1,
  persistAndReloadWorkbenchDraftV1,
  workbenchCalculationBlockersV1,
} from "./workbench-ui-client-v1";
import {
  resolveRfDraftRecoveryDecision,
  RF_DRAFT_RECOVERY_CONTRACT_VERSION,
} from "@/lib/admin-next/rf-draft-recovery-contract";
import { buildWorkbenchDraftRecoveryBindingV1 } from "./workbench-draft-recovery-v1";

const hash = "a".repeat(64);
const georeference = {
  crs: "EPSG:25833" as const,
  extentTrust: "actual-visible-extent" as const,
  bounds: {
    minEastingM: 500_000,
    minNorthingM: 6_640_000,
    maxEastingM: 500_020,
    maxNorthingM: 6_640_010,
  },
  imageWidth: 2_000,
  imageHeight: 1_000,
};
const outline = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];

async function draft(
  lines: Parameters<typeof buildWorkbenchDraftFromUiV1>[0]["lines"] = [],
) {
  return buildWorkbenchDraftFromUiV1({
    caseId: "lead:13",
    actorId: "7",
    revision: 1,
    draftId: "uat-lead-13-r1-test",
    idempotencyKey: "workbench:lead:13:r1:test",
    createdAt: "2026-09-03T08:00:00.000Z",
    sourceOutline: outline,
    approvedOutline: outline,
    lines,
    evidence: {
      sourceId: "norge-i-bilder:91",
      sourceContentHash: hash,
      attribution: "©norgeibilder.no",
      imageId: 91,
      georeference,
    },
  });
}

describe("Roof Fusion workbench UI persistence contract", () => {
  it("snaps symmetrically near the boundary while preserving far-interior points", () => {
    const approved = [
      { x: 0.4, y: 0.3 },
      { x: 0.6, y: 0.3 },
      { x: 0.6, y: 0.7 },
      { x: 0.4, y: 0.7 },
    ];
    const inside = { x: 0.5, y: 0.5 };
    expect(
      constrainWorkbenchPointToOutlineV1(inside, approved, {
        xPixelsPerImageUnit: 1_000,
        yPixelsPerImageUnit: 500,
        maxDistancePixels: 14,
      }),
    ).toBe(inside);
    expect(
      constrainWorkbenchPointToOutlineV1({ x: 0.404, y: 0.5 }, approved, {
        xPixelsPerImageUnit: 3_000,
        yPixelsPerImageUnit: 1_500,
        maxDistancePixels: 14,
      }),
    ).toEqual({ x: 0.4, y: 0.5 });
    expect(
      constrainWorkbenchPointToOutlineV1({ x: 0.388, y: 0.5 }, approved, {
        xPixelsPerImageUnit: 1_000,
        yPixelsPerImageUnit: 500,
        maxDistancePixels: 14,
      }),
    ).toEqual({ x: 0.4, y: 0.5 });
    expect(
      constrainWorkbenchPointToOutlineV1({ x: 0.396, y: 0.5 }, approved, {
        xPixelsPerImageUnit: 3_000,
        yPixelsPerImageUnit: 1_500,
        maxDistancePixels: 14,
      }),
    ).toEqual({ x: 0.4, y: 0.5 });
    expect(() =>
      constrainWorkbenchPointToOutlineV1({ x: 0.394, y: 0.5 }, approved, {
        xPixelsPerImageUnit: 3_000,
        yPixelsPerImageUnit: 1_500,
        maxDistancePixels: 14,
      }),
    ).toThrow("SKELETON_ENDPOINT_OUTSIDE_MASS");
  });

  it("snaps to the closing edge of a concave approved outline", () => {
    const concave = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.5, y: 0.5 },
      { x: 0.2, y: 0.8 },
    ];

    expect(
      constrainWorkbenchPointToOutlineV1({ x: 0.19, y: 0.5 }, concave, {
        xPixelsPerImageUnit: 1_000,
        yPixelsPerImageUnit: 500,
        maxDistancePixels: 14,
      }),
    ).toEqual({ x: 0.2, y: 0.5 });
  });

  it("constructs a server-valid EPSG:25833 draft from approved pixels and exact capture evidence", async () => {
    const value = await draft();
    expect(() => parseRoofFusionWorkbenchDraftV1(value)).not.toThrow();
    expect(value.geometry.vertices[0]).toMatchObject({
      xM: 500_002,
      yM: 6_640_009,
    });
    expect(value.source.sourceContentHash).toBe(hash);
    expect(value.source.georeference.extentTrust).toBe("actual-visible-extent");
  });

  it("constrains near-boundary skeleton endpoints to the approved mass before server parsing", async () => {
    const value = await draft([
      {
        id: "ridge-ui",
        kind: "ridge",
        start: { x: 0.099_999_999, y: 0.5 },
        end: { x: 0.900_000_001, y: 0.5 },
      },
    ]);

    expect(() => parseRoofFusionWorkbenchDraftV1(value)).not.toThrow();
    expect(value.geometry.vertices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ xM: 500_002, yM: 6_640_005 }),
        expect.objectContaining({ xM: 500_018, yM: 6_640_005 }),
      ]),
    );
  });

  it("rejects a skeleton endpoint far outside the approved mass with the semantic code", async () => {
    await expect(
      draft([
        {
          id: "ridge-ui",
          kind: "ridge",
          start: { x: 0.02, y: 0.5 },
          end: { x: 0.9, y: 0.5 },
        },
      ]),
    ).rejects.toMatchObject({
      code: "SKELETON_ENDPOINT_OUTSIDE_MASS",
    });
  });

  it("rejects a zero-length skeleton after endpoint constraints before POST", async () => {
    await expect(
      draft([
        {
          id: "ridge-ui",
          kind: "ridge",
          start: { x: 0.5, y: 0.5 },
          end: { x: 0.501, y: 0.5 },
        },
      ]),
    ).rejects.toMatchObject({ code: "SKELETON_ZERO_LENGTH" });
  });

  it("saves with CAS and proves persistence by reloading the exact draft hash", async () => {
    const value = await draft();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "applied",
            confirmation: { status: "applied" },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draft: value }), { status: 200 }),
      );

    const result = await persistAndReloadWorkbenchDraftV1(value, null, fetcher);

    expect(result.status).toBe("applied");
    expect(result.draft.draftHash).toBe(value.draftHash);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "/api/admin/roof-fusion/workbench-draft",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetcher.mock.calls[1]?.[0]).toContain(`draftId=${value.draftId}`);
  });

  it("surfaces revision conflict and preserves idempotent replay feedback", async () => {
    const value = await draft();
    const conflictFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "EXPECTED_REVISION_MISMATCH",
          error: "changed",
        }),
        { status: 409 },
      ),
    );
    await expect(
      persistAndReloadWorkbenchDraftV1(value, null, conflictFetch),
    ).rejects.toMatchObject({
      code: "EXPECTED_REVISION_MISMATCH",
      status: 409,
    });

    const replayFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "replayed" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draft: value }), { status: 200 }),
      );
    await expect(
      persistAndReloadWorkbenchDraftV1(value, null, replayFetch),
    ).resolves.toMatchObject({ status: "replayed" });
  });

  it.each([
    [
      "connection failure",
      new TypeError("secret internal endpoint"),
      "LOAD_CONNECTION_FAILED",
      "Nepavyko prisijungti prie serverio įkeliant reviziją",
    ],
    [
      "timeout",
      new DOMException("secret timeout detail", "TimeoutError"),
      "LOAD_TIMEOUT",
      "Revizijos įkėlimas užtruko per ilgai",
    ],
  ])(
    "classifies a load %s without exposing the rejected fetch detail",
    async (_label, failure, code, message) => {
      const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure);

      await expect(
        loadWorkbenchDraftV1("lead:13", fetcher),
      ).rejects.toMatchObject({
        code,
        status: 0,
        message: expect.stringContaining(message),
      });
      await expect(
        loadWorkbenchDraftV1("lead:13", fetcher),
      ).rejects.not.toThrow(/secret/iu);
    },
  );

  it.each([
    [
      "connection failure",
      new TypeError("secret save endpoint"),
      "SAVE_CONNECTION_FAILED",
    ],
    [
      "timeout",
      new DOMException("secret timeout detail", "AbortError"),
      "SAVE_TIMEOUT",
    ],
  ])(
    "classifies a save %s and keeps retry guidance explicit",
    async (_label, failure, code) => {
      const value = await draft();
      const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure);

      await expect(
        persistAndReloadWorkbenchDraftV1(value, null, fetcher),
      ).rejects.toMatchObject({
        code,
        status: 0,
        message: expect.stringContaining(
          "dar kartą spauskite „Išsaugoti ir patvirtinti reviziją“",
        ),
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it("fails closed when the save response succeeds but the hash-proof reload loses connection", async () => {
    const value = await draft();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "applied" }), { status: 201 }),
      )
      .mockRejectedValueOnce(new TypeError("secret reload endpoint"));

    await expect(
      persistAndReloadWorkbenchDraftV1(value, null, fetcher),
    ).rejects.toMatchObject({
      code: "LOAD_CONNECTION_FAILED",
      status: 0,
      message: expect.stringContaining("spauskite „Perkrauti“"),
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("still rejects a successful reload whose draft hash does not match", async () => {
    const value = await draft();
    const mismatched = { ...value, draftHash: "b".repeat(64) };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "applied" }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draft: mismatched }), { status: 200 }),
      );

    await expect(
      persistAndReloadWorkbenchDraftV1(value, null, fetcher),
    ).rejects.toMatchObject({ code: "RELOAD_MISMATCH", status: 409 });
  });

  it("blocks calculation when georef, full height, or reloaded hash proof is missing", () => {
    expect(
      workbenchCalculationBlockersV1({
        trustedOrthophoto: false,
        completeHeightSurface: false,
        storedDraftHashConfirmed: false,
      }),
    ).toEqual([
      "TRUSTED_ORTHOPHOTO_REQUIRED",
      "COMPLETE_HEIGHT_SURFACE_REQUIRED",
      "STORED_DRAFT_HASH_REQUIRED",
    ]);
  });

  it("marks complex skeleton subdivision for review instead of inventing surface ownership", async () => {
    const value = await draft([
      {
        id: "ridge-ui",
        kind: "ridge",
        start: { x: 0.5, y: 0.2 },
        end: { x: 0.5, y: 0.8 },
      },
    ]);
    expect(value.state).toBe("review_required");
    expect(value.blockers.join(" ")).toContain("nespėja");
    expect(value.geometry.skeletonEdges).toHaveLength(1);
    expect(value.geometry.openings).toEqual([]);
    expect(value.geometry.obstacles).toEqual([]);
  });

  it("loads the latest case-scoped draft and treats a true not-found as an empty entry state", async () => {
    const value = await draft();
    const found = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ draft: value }), { status: 200 }),
      );
    await expect(loadWorkbenchDraftV1("lead:13", found)).resolves.toEqual(
      value,
    );
    expect(found.mock.calls[0]?.[0]).toContain("caseId=lead%3A13");

    const missing = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: "DRAFT_NOT_FOUND" }), {
        status: 404,
      }),
    );
    await expect(loadWorkbenchDraftV1("lead:13", missing)).resolves.toBeNull();
  });

  it("loads and validates the server-owned recovery decision with the visible source pin", async () => {
    const value = await draft();
    const recoveryBinding = buildWorkbenchDraftRecoveryBindingV1({
      draft: value,
      addressRevision: 2,
    });
    const recoveryDecision = resolveRfDraftRecoveryDecision({
      version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
      vercelEnvironment: "preview",
      capabilities: ["roof_fusion.draft.continue", "roof_fusion.draft.create"],
      current: {
        case: recoveryBinding.case,
        source: recoveryBinding.source,
        snapshot: recoveryBinding.snapshot,
      },
      persistedDraft: {
        draft: recoveryBinding.draft,
        recoveryBinding,
      },
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ draft: value, recoveryDecision }), {
        status: 200,
      }),
    );

    await expect(
      loadWorkbenchDraftRecoveryV1(
        "lead:13",
        { id: value.source.sourceId, hash: value.source.sourceContentHash },
        fetcher,
      ),
    ).resolves.toEqual({ draft: value, recoveryDecision });
    expect(fetcher.mock.calls[0]?.[0]).toContain(
      `sourceId=${encodeURIComponent(value.source.sourceId)}`,
    );
    expect(fetcher.mock.calls[0]?.[0]).toContain(
      `sourceHash=${value.source.sourceContentHash}`,
    );
  });

  it("fails closed when the recovery decision response is missing or malformed", async () => {
    const value = await draft();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ draft: value }), { status: 200 }),
      );

    await expect(
      loadWorkbenchDraftRecoveryV1(
        "lead:13",
        { id: value.source.sourceId, hash: value.source.sourceContentHash },
        fetcher,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RECOVERY_DECISION", status: 409 });
  });
});
