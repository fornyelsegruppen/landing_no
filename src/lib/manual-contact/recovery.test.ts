import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { createOpaqueToken } from "@/lib/security/opaque-token";
import {
  consumeManualContactRecoveryToken,
  issueManualContactRecoveryToken,
  normalizeCommunicationEmail,
  resolveManualContactRecoveryToken,
} from "./recovery";

describe("manual contact recovery tokens", () => {
  it("normalizes communication addresses", () => {
    expect(normalizeCommunicationEmail("  KUNDE@Example.NO ")).toBe(
      "kunde@example.no",
    );
  });

  it("stores only a hash and resolves the message-bound lead", async () => {
    let storedToken: Record<string, unknown> | undefined;
    const payload = {
      update: vi.fn(
        async ({
          collection,
          data,
        }: {
          collection: string;
          data: Record<string, unknown>;
        }) => {
          if (collection === "access-tokens" && data.revokedAt && storedToken) {
            storedToken.revokedAt = data.revokedAt;
          }
          return { docs: [] };
        },
      ),
      create: vi.fn(
        async ({
          collection,
          data,
        }: {
          collection: string;
          data: Record<string, unknown>;
        }) => {
          expect(collection).toBe("access-tokens");
          storedToken = { id: 19, ...data };
          return storedToken;
        },
      ),
      find: vi.fn(async () => ({ docs: storedToken ? [storedToken] : [] })),
      findByID: vi.fn(async ({ collection }: { collection: string }) =>
        collection === "messages"
          ? {
              id: 7,
              lead: 3,
              direction: "outbound",
              channel: "email",
              status: "failed",
            }
          : { id: 3, name: "Ola", recordState: "active" },
      ),
    } as unknown as Payload;

    const issued = await issueManualContactRecoveryToken(payload, 7, {
      leadId: 3,
    });
    expect(JSON.stringify(storedToken)).not.toContain(issued.token);
    await expect(
      resolveManualContactRecoveryToken(payload, issued.token),
    ).resolves.toMatchObject({
      lead: { id: 3 },
      sourceMessage: { id: 7 },
    });
  });

  it("rejects a recovery token when its source is not an active outbound email", async () => {
    const created = createOpaqueToken({
      purpose: "manual-contact-recovery",
      ttlMs: 60_000,
    });
    const payload = {
      find: vi.fn(async () => ({
        docs: [
          {
            id: 19,
            ...created.stored,
            subjectType: "message",
            subjectId: "7",
            singleUse: true,
          },
        ],
      })),
      findByID: vi.fn(async () => ({
        id: 7,
        lead: 3,
        direction: "outbound",
        channel: "email",
        status: "cancelled",
      })),
    } as unknown as Payload;

    await expect(
      resolveManualContactRecoveryToken(payload, created.plainText),
    ).resolves.toBeNull();
  });

  it("claims a single-use token with an atomic conditional update", async () => {
    const update = vi.fn(async () => ({ docs: [{ id: 19 }] }));
    const payload = { update } as unknown as Payload;
    const usedAt = "2026-08-28T00:00:00.000Z";

    await expect(
      consumeManualContactRecoveryToken(payload, 19, usedAt),
    ).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "access-tokens",
        where: {
          and: expect.arrayContaining([
            { id: { equals: 19 } },
            { usedAt: { exists: false } },
            { revokedAt: { exists: false } },
          ]),
        },
        data: { usedAt },
      }),
    );
  });

  it("reports a lost token claim without mutating anything else", async () => {
    const payload = {
      update: vi.fn(async () => ({ docs: [] })),
    } as unknown as Payload;

    await expect(
      consumeManualContactRecoveryToken(
        payload,
        19,
        "2026-08-28T00:00:00.000Z",
      ),
    ).resolves.toBe(false);
  });
});
