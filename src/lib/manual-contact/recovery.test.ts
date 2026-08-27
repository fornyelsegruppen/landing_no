import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
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
          ? { id: 7, lead: 3, direction: "outbound" }
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
});
