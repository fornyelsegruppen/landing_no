import { createHash } from "node:crypto";
import type {
  AiGenerateRequest,
  AiGenerateResult,
  AiProvider,
  DeliveryResult,
  EmailMessage,
  EmailProvider,
  MapProvider,
  ProviderHealth,
  SearchDataProvider,
  SearchSignal,
  SignatureEvidence,
  SignatureProvider,
  SmsMessage,
  SmsProvider,
} from "./contracts";
import { ProviderUnavailableError } from "./contracts";

export class DeterministicAiProvider implements AiProvider {
  constructor(
    private readonly response: unknown,
    private readonly promptVersion = "test-v1",
  ) {}

  health(): ProviderHealth {
    return { status: "ready", provider: "deterministic-ai" };
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    return {
      data: structuredClone(this.response),
      provider: "deterministic-ai",
      model: "fixture",
      promptVersion: this.promptVersion || request.schemaName,
    };
  }
}

export class LogEmailProvider implements EmailProvider {
  readonly deliveries: Array<{
    template: string;
    idempotencyKey: string;
    correlationId: string;
  }> = [];

  health(): ProviderHealth {
    return { status: "ready", provider: "log-email" };
  }

  async send(message: EmailMessage): Promise<DeliveryResult> {
    this.deliveries.push({
      template: message.template,
      idempotencyKey: message.idempotencyKey,
      correlationId: message.correlationId,
    });
    const providerMessageId = createHash("sha256")
      .update(message.idempotencyKey)
      .digest("hex")
      .slice(0, 24);
    return {
      provider: "log-email",
      providerMessageId,
      acceptedAt: new Date().toISOString(),
    };
  }
}

export class DisabledSmsProvider implements SmsProvider {
  health(): ProviderHealth {
    return { status: "disabled", provider: "disabled-sms" };
  }

  async send(message: SmsMessage): Promise<DeliveryResult> {
    void message;
    throw new ProviderUnavailableError("disabled-sms", "disabled");
  }
}

export class EmptyMapProvider implements MapProvider {
  health(): ProviderHealth {
    return {
      status: "configuration_required",
      provider: "empty-map",
      detail: "No imagery provider configured",
    };
  }

  async searchAddress() {
    return [];
  }
}

export class InternalSignatureVerifier implements SignatureProvider {
  health(): ProviderHealth {
    return { status: "ready", provider: "internal-signature" };
  }

  async verifyEvidence(evidence: SignatureEvidence) {
    return (
      /^[a-f0-9]{64}$/i.test(evidence.documentHash) &&
      Number.isFinite(new Date(evidence.signedAt).getTime()) &&
      Boolean(evidence.method)
    );
  }
}

export class StaticSearchDataProvider implements SearchDataProvider {
  constructor(private readonly signals: SearchSignal[]) {}

  health(): ProviderHealth {
    return { status: "ready", provider: "static-search-data" };
  }

  async listSignals() {
    return structuredClone(this.signals);
  }
}
