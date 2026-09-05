export type ProviderHealth = {
  status: "ready" | "configuration_required" | "disabled" | "degraded";
  provider: string;
  detail?: string;
};

export type AiGenerateRequest = {
  task: string;
  system: string;
  prompt: string;
  schemaName: string;
  schema?: Record<string, unknown>;
  correlationId: string;
  attachments?: Array<{
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    dataBase64: string;
  }>;
};

export type AiGenerateResult = {
  data: unknown;
  provider: string;
  model: string;
  promptVersion: string;
};

export interface AiProvider {
  health(): ProviderHealth;
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
}

export type EmailMessage = {
  template: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  idempotencyKey: string;
  correlationId: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBase64: string;
  }>;
};

export type DeliveryResult = {
  provider: string;
  providerMessageId: string;
  acceptedAt: string;
};

export interface EmailProvider {
  health(): ProviderHealth;
  send(message: EmailMessage): Promise<DeliveryResult>;
}

export type SmsMessage = {
  template: string;
  to: string;
  text: string;
  idempotencyKey: string;
  correlationId: string;
};

export interface SmsProvider {
  health(): ProviderHealth;
  send(message: SmsMessage): Promise<DeliveryResult>;
}

export type AddressCandidate = {
  id: string;
  label: string;
  /** Structured street and house number when supplied by the provider. */
  streetAddress?: string;
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
  source: string;
};

export interface MapProvider {
  health(): ProviderHealth;
  searchAddress(query: string): Promise<AddressCandidate[]>;
}

export type SignatureEvidence = {
  documentHash: string;
  signedAt: string;
  method: string;
  evidence: Record<string, string | number | boolean>;
};

export interface SignatureProvider {
  health(): ProviderHealth;
  verifyEvidence(evidence: SignatureEvidence): Promise<boolean>;
}

export type SearchSignal = {
  source: "search-console" | "ads" | "trends" | "lead" | "manual";
  query: string;
  impressions?: number;
  clicks?: number;
  score?: number;
  periodStart?: string;
  periodEnd?: string;
};

export interface SearchDataProvider {
  health(): ProviderHealth;
  listSignals(): Promise<SearchSignal[]>;
}

export class ProviderUnavailableError extends Error {
  constructor(
    readonly provider: string,
    readonly status: ProviderHealth["status"],
  ) {
    super(`Provider ${provider} is ${status}`);
    this.name = "ProviderUnavailableError";
  }
}
