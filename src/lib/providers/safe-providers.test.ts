import { describe, expect, it } from "vitest";
import {
  DeterministicAiProvider,
  DisabledSmsProvider,
  InternalSignatureVerifier,
  LogEmailProvider,
  StaticSearchDataProvider,
} from "./safe-providers";

describe("safe local providers", () => {
  it("returns deterministic AI data without an external call", async () => {
    const provider = new DeterministicAiProvider({ title: "Takvask" });
    const result = await provider.generate({
      task: "draft",
      system: "system",
      prompt: "prompt",
      schemaName: "article",
      correlationId: "test-1",
    });

    expect(result.data).toEqual({ title: "Takvask" });
    expect(result.provider).toBe("deterministic-ai");
  });

  it("logs only operational email identifiers", async () => {
    const provider = new LogEmailProvider();
    const result = await provider.send({
      template: "lead-received",
      to: "customer@example.com",
      subject: "Private subject",
      text: "Private body",
      idempotencyKey: "lead:1:receipt",
      correlationId: "corr-1",
    });

    expect(provider.deliveries).toEqual([
      {
        template: "lead-received",
        idempotencyKey: "lead:1:receipt",
        correlationId: "corr-1",
      },
    ]);
    expect(JSON.stringify(provider.deliveries)).not.toContain("customer@");
    expect(result.providerMessageId).toHaveLength(24);
  });

  it("fails closed when SMS is disabled", async () => {
    const provider = new DisabledSmsProvider();
    await expect(
      provider.send({
        template: "reminder",
        to: "+4700000000",
        text: "Reminder",
        idempotencyKey: "sms:1",
        correlationId: "corr-2",
      }),
    ).rejects.toThrow("disabled");
  });

  it("validates minimum internal signature evidence", async () => {
    const provider = new InternalSignatureVerifier();
    await expect(
      provider.verifyEvidence({
        documentHash: "a".repeat(64),
        signedAt: "2026-08-23T12:00:00.000Z",
        method: "drawn",
        evidence: {},
      }),
    ).resolves.toBe(true);
  });

  it("returns cloned search fixtures", async () => {
    const provider = new StaticSearchDataProvider([
      { source: "manual", query: "takvask pris" },
    ]);
    const signals = await provider.listSignals();
    expect(signals).toEqual([{ source: "manual", query: "takvask pris" }]);
  });
});
