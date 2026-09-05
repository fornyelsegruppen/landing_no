import { beforeEach, describe, expect, it, vi } from "vitest";

const transactions = vi.hoisted(() => ({
  commit: vi.fn(),
  init: vi.fn(),
  kill: vi.fn(),
}));

vi.mock("payload", () => ({
  commitTransaction: transactions.commit,
  initTransaction: transactions.init,
  killTransaction: transactions.kill,
}));

import {
  assertPreviewE2ECommercialBootstrapEnvironment,
  PREVIEW_E2E_ISOLATED_DB_FINGERPRINT,
  previewE2EPriceRule,
  previewE2ETerms,
  retirePreviewE2ECommercialConfig,
} from "./preview-e2e-commercial-config";

const approvedHost =
  `ep-${PREVIEW_E2E_ISOLATED_DB_FINGERPRINT}-pooler.eu-central-1.aws.neon.tech`;
const approvedEnvironment = {
  PREVIEW_E2E_BOOTSTRAP: "isolated-preview-only",
  PREVIEW_E2E_NONBINDING_DOCUMENTS: "true",
  PREVIEW_E2E_EXPECTED_DB_HOST: approvedHost,
  VERCEL_ENV: "preview",
  DATABASE_URL: `postgresql://redacted@${approvedHost}/redacted`,
};

describe("Preview E2E commercial bootstrap", () => {
  beforeEach(() => {
    transactions.commit.mockReset().mockResolvedValue(undefined);
    transactions.init.mockReset().mockResolvedValue(true);
    transactions.kill.mockReset().mockResolvedValue(undefined);
  });

  it("accepts only the exact approved isolated Preview database host", () => {
    expect(
      assertPreviewE2ECommercialBootstrapEnvironment(approvedEnvironment),
    ).toEqual({ databaseHost: approvedHost });
    expect(() =>
      assertPreviewE2ECommercialBootstrapEnvironment({
        ...approvedEnvironment,
        PREVIEW_E2E_EXPECTED_DB_HOST: `copy-${approvedHost}`,
      }),
    ).toThrow(/does not match/u);
    expect(() =>
      assertPreviewE2ECommercialBootstrapEnvironment({
        ...approvedEnvironment,
        VERCEL_ENV: "production",
      }),
    ).toThrow(/nonbinding document mode/u);
  });

  it("uses unmistakably synthetic, nonbinding terms and one bounded service rule", () => {
    expect(previewE2ETerms.contractText).toMatch(/IKKE BINDENDE/u);
    expect(previewE2ETerms.contractText).toMatch(/syntetiske testdata/u);
    expect(previewE2EPriceRule.serviceKey).toBe("takvask");
    expect(previewE2EPriceRule.notes).toMatch(/NOT A COMMERCIAL PRICE/u);
  });

  it("returns absent without fabricating a retired audit in an empty database", async () => {
    const create = vi.fn();
    const update = vi.fn();
    const find = vi.fn().mockResolvedValue({ docs: [] });

    await expect(
      retirePreviewE2ECommercialConfig({
        payload: { create, find, update } as never,
        administrator: { id: 7 },
        environment: approvedEnvironment,
      }),
    ).resolves.toEqual({ status: "absent", retired: [] });

    expect(find).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(transactions.commit).toHaveBeenCalledTimes(1);
    expect(transactions.kill).not.toHaveBeenCalled();
  });

  it("returns already_retired without an audit when nothing is approved", async () => {
    const create = vi.fn();
    const update = vi.fn();
    const find = vi.fn().mockImplementation(({ collection }) => ({
      docs:
        collection === "contract-terms"
          ? [{ id: 11, status: "retired" }]
          : [{ id: 12, status: "draft" }],
    }));

    await expect(
      retirePreviewE2ECommercialConfig({
        payload: { create, find, update } as never,
        administrator: { id: 7 },
        environment: approvedEnvironment,
      }),
    ).resolves.toEqual({ status: "already_retired", retired: [] });

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(transactions.commit).toHaveBeenCalledTimes(1);
  });

  it("audits only the configuration item that was actually retired", async () => {
    const create = vi.fn().mockResolvedValue({ id: 90 });
    const update = vi.fn().mockResolvedValue({ id: 11, status: "retired" });
    const find = vi.fn().mockImplementation(({ collection }) => ({
      docs:
        collection === "contract-terms"
          ? [{ id: 11, status: "approved" }]
          : [],
    }));

    await expect(
      retirePreviewE2ECommercialConfig({
        payload: { create, find, update } as never,
        administrator: { id: 7 },
        environment: approvedEnvironment,
      }),
    ).resolves.toEqual({
      status: "retired",
      retired: ["contractTerms"],
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "contract-terms",
        data: { status: "retired" },
        id: 11,
      }),
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "audit-events",
        data: expect.objectContaining({
          action: "preview-e2e.commercial-config-retired",
          changedFields: ["contractTerms.status"],
        }),
      }),
    );
    expect(transactions.commit).toHaveBeenCalledTimes(1);
  });
});
