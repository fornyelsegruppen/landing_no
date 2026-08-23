import { createSign } from "node:crypto";
import type { ProviderHealth, SearchDataProvider, SearchSignal } from "./contracts";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function credentials(environment: NodeJS.ProcessEnv = process.env): ServiceAccount | null {
  const raw = environment.GOOGLE_SEARCH_CONSOLE_CREDENTIALS?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key, token_uri: parsed.token_uri };
  } catch {
    return null;
  }
}

async function accessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = account.token_uri || "https://oauth2.googleapis.com/token";
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Search Console token request failed (${response.status})`);
  const result = (await response.json()) as { access_token?: string };
  if (!result.access_token) throw new Error("Search Console token response was invalid");
  return result.access_token;
}

export class GoogleSearchConsoleProvider implements SearchDataProvider {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}

  health(): ProviderHealth {
    if (!credentials(this.environment) || !this.environment.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim()) {
      return { status: "configuration_required", provider: "google-search-console", detail: "Credentials and site URL are required" };
    }
    return { status: "ready", provider: "google-search-console" };
  }

  async listSignals(): Promise<SearchSignal[]> {
    const account = credentials(this.environment);
    const siteUrl = this.environment.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim();
    if (!account || !siteUrl) return [];
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 3);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 89);
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await accessToken(account)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          dimensions: ["query"],
          rowLimit: 1000,
          dataState: "final",
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) throw new Error(`Search Console query failed (${response.status})`);
    const result = (await response.json()) as {
      rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number }>;
    };
    return (result.rows || []).flatMap((row) => {
      const query = row.keys?.[0]?.trim();
      if (!query) return [];
      return [{
        source: "search-console" as const,
        query,
        clicks: row.clicks,
        impressions: row.impressions,
        periodStart: start.toISOString().slice(0, 10),
        periodEnd: end.toISOString().slice(0, 10),
      }];
    });
  }

  async listPagePerformance() {
    const account = credentials(this.environment);
    const siteUrl = this.environment.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim();
    if (!account || !siteUrl) return [];
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 3);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 89);
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await accessToken(account)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          dimensions: ["page"],
          rowLimit: 1000,
          dataState: "final",
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) throw new Error(`Search Console page query failed (${response.status})`);
    const result = (await response.json()) as {
      rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
    };
    return (result.rows || []).flatMap((row) => {
      const url = row.keys?.[0];
      if (!url) return [];
      return [{ url, clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0 }];
    });
  }

  async inspectUrl(url: string) {
    const account = credentials(this.environment);
    const siteUrl = this.environment.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim();
    if (!account || !siteUrl) return null;
    const response = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken(account)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: "nb-NO" }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Search Console URL inspection failed (${response.status})`);
    const result = (await response.json()) as {
      inspectionResult?: { indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        robotsTxtState?: string;
        indexingState?: string;
        lastCrawlTime?: string;
      } };
    };
    return result.inspectionResult?.indexStatusResult || null;
  }
}
