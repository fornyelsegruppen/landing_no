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
  /** How this aggregated signal entered the topic pipeline, when known. */
  origin?: "api" | "csv-import" | "manual";
  query: string;
  impressions?: number;
  clicks?: number;
  score?: number;
  periodStart?: string;
  periodEnd?: string;
};

export type SearchSignalObservationWindow = {
  periodStart: string;
  periodEnd: string;
  /** Empty is explicitly no observed data, never a synthetic zero-popularity row. */
  status: "available" | "no-data";
  signals: SearchSignal[];
};

export type SearchSignalRefresh = {
  current: SearchSignalObservationWindow;
  baseline: SearchSignalObservationWindow;
  /** No city or demographic claim is made unless a provider explicitly proves it. */
  geography: "unknown";
};

export interface SearchDataProvider {
  health(): ProviderHealth;
  listSignals(): Promise<SearchSignal[]>;
  listSignalRefresh?(): Promise<SearchSignalRefresh>;
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
