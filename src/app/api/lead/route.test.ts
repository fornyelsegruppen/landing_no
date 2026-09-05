import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  find: vi.fn(),
  operationalNotice: vi.fn(),
  receipt: vi.fn(),
  deliver: vi.fn(),
  enqueueAi: vi.fn(),
  resendSend: vi.fn(),
  verifyTurnstile: vi.fn(),
  searchAddress: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.resendSend };
  },
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({ create: mocks.create, find: mocks.find })),
}));
vi.mock("@/lib/messages/message-engine", () => ({
  createReceiptMessage: mocks.receipt,
  deliverMessage: mocks.deliver,
  enqueueLeadAiJob: mocks.enqueueAi,
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  rateLimit: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile,
}));
vi.mock("@/lib/monitoring", () => ({
  captureException: vi.fn(),
  captureOperationalNotice: mocks.operationalNotice,
}));
vi.mock("@/lib/providers/kartverket-address-provider", () => ({
  KartverketAddressProvider: class {
    searchAddress = mocks.searchAddress;
  },
}));

import { POST } from "./route";

function request(email?: string) {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Kunde",
      phone: "47 73 58 88",
      ...(email ? { email } : {}),
      postal: "1182",
      type: "takvask",
      locale: "no",
      consent: true,
      consentText: "Jeg godtar at henvendelsen behandles.",
    }),
  });
}

function requestWithBody(body: Record<string, unknown>) {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Kunde",
      postal: "1182",
      type: "takvask",
      locale: "no",
      consent: true,
      consentText: "Jeg godtar at henvendelsen behandles.",
      ...body,
    }),
  });
}

describe("public lead durability", () => {
  beforeEach(() => {
    process.env.PAYLOAD_SECRET = "test-secret-at-least-32-characters-long";
    delete process.env.RESEND_API_KEY;
    delete process.env.FEATURE_AI_DRAFTS;
    delete process.env.PREVIEW_EMAIL_RECIPIENT_ALLOWLIST;
    delete process.env.LEAD_TO_EMAIL;
    delete process.env.LEAD_ADMIN_NOTIFICATION_FALLBACK_LOCALE;
    mocks.create.mockReset().mockResolvedValue({ id: 55 });
    mocks.find.mockReset().mockResolvedValue({ docs: [] });
    mocks.operationalNotice.mockReset();
    mocks.receipt
      .mockReset()
      .mockResolvedValue({ skipped: true, reason: "no_email" });
    mocks.deliver.mockReset();
    mocks.enqueueAi.mockReset();
    mocks.resendSend
      .mockReset()
      .mockResolvedValue({ data: { id: "preview-intake-1" }, error: null });
    mocks.verifyTurnstile.mockReset().mockResolvedValue({
      ok: true,
      skipped: true,
    });
    mocks.searchAddress.mockReset().mockResolvedValue([
      {
        id: "0301-1-2-0-0-Testveien 1",
        label: "Testveien 1, 1182 OSLO",
        streetAddress: "Testveien 1",
        postalCode: "1182",
        city: "OSLO",
        latitude: 59.8901,
        longitude: 10.7901,
        source: "Kartverket",
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.FEATURE_AI_DRAFTS;
    delete process.env.RESEND_API_KEY;
    delete process.env.PREVIEW_EMAIL_RECIPIENT_ALLOWLIST;
    delete process.env.LEAD_TO_EMAIL;
    delete process.env.LEAD_ADMIN_NOTIFICATION_FALLBACK_LOCALE;
  });

  it("returns success after the lead is saved even when receipt creation fails", async () => {
    mocks.receipt.mockRejectedValueOnce(new Error("email unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, id: 55 });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "leads",
        data: expect.objectContaining({
          nextAction: expect.stringContaining("Ring kunden"),
        }),
      }),
    );
  });

  it("keeps the saved lead when AI job enqueueing fails", async () => {
    process.env.FEATURE_AI_DRAFTS = "true";
    mocks.enqueueAi.mockRejectedValueOnce(new Error("AI queue unavailable"));
    const response = await POST(request("kunde@example.test"));
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueAi).toHaveBeenCalledWith(
      expect.anything(),
      55,
      expect.any(String),
    );
  });

  it("rejects a consumed Turnstile token before creating a lead", async () => {
    mocks.verifyTurnstile.mockResolvedValueOnce({
      ok: false,
      skipped: false,
      errorCodes: ["timeout-or-duplicate"],
    });

    const response = await POST(request("kunde@example.test"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Captcha failed" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.receipt).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.enqueueAi).not.toHaveBeenCalled();
  });

  it("restricts and brands the Preview intake notification", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    process.env.RESEND_API_KEY = "preview-resend-key";
    process.env.PREVIEW_EMAIL_RECIPIENT_ALLOWLIST =
      "fornyelsegruppen@gmail.com";
    process.env.LEAD_TO_EMAIL = "fornyelsegruppen@gmail.com";

    const allowed = await POST(request("fornyelsegruppen@gmail.com"));
    expect(allowed.status).toBe(200);
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "fornyelsegruppen@gmail.com",
        subject: expect.stringMatching(/^\[PREVIEW TEST\] /u),
      }),
    );

    mocks.resendSend.mockClear();
    process.env.LEAD_TO_EMAIL = "other@example.no";
    const blocked = await POST(request("fornyelsegruppen@gmail.com"));
    expect(blocked.status).toBe(200);
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it("uses the recipient administrator's saved Lithuanian language for a Norwegian customer enquiry", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    process.env.RESEND_API_KEY = "preview-resend-key";
    process.env.PREVIEW_EMAIL_RECIPIENT_ALLOWLIST = "owner@example.no";
    process.env.LEAD_TO_EMAIL = "owner@example.no";
    mocks.find.mockResolvedValueOnce({
      docs: [
        {
          active: true,
          email: "owner@example.no",
          interfaceLanguage: "lt",
          role: "admin",
        },
      ],
    });

    const originalMessage = "Vask taket, men behold denne teksten uendret.";
    const response = await POST(
      requestWithBody({
        email: "kunde@example.no",
        locale: "no",
        message: originalMessage,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        where: expect.objectContaining({ and: expect.any(Array) }),
      }),
    );
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('lang="lt"'),
        subject: expect.stringMatching(
          /^\[PREVIEW TEST\] Vidinis administratoriaus pranešimas/u,
        ),
        text: expect.stringContaining("Kliento kalba: Norvegų"),
        to: "owner@example.no",
      }),
    );
    const sent = mocks.resendSend.mock.calls[0]?.[0] as {
      attachments: Array<{ filename: string }>;
      html: string;
      text: string;
    };
    expect(sent.attachments[0]?.filename).toMatch(/^uzklausa-55-/u);
    expect(sent.text).toContain(originalMessage);
    expect(sent.html).toContain(originalMessage);
    expect(sent.text).toContain("Tai vidinis administratoriaus pranešimas");
  });

  it("keeps a Norwegian admin notification Norwegian for a Norwegian customer", async () => {
    process.env.RESEND_API_KEY = "resend-key";
    process.env.LEAD_TO_EMAIL = "owner@example.no";
    mocks.find.mockResolvedValueOnce({
      docs: [
        {
          active: true,
          email: "owner@example.no",
          interfaceLanguage: "nb",
          role: "admin",
        },
      ],
    });

    const response = await POST(request("kunde@example.no"));

    expect(response.status).toBe(200);
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringMatching(/^Internt adminvarsel/u),
        text: expect.stringContaining("Kundespråk: Norsk"),
      }),
    );
  });

  it("records use of the explicit language fallback when no admin profile matches", async () => {
    process.env.RESEND_API_KEY = "resend-key";
    process.env.LEAD_TO_EMAIL = "archive@example.no";
    process.env.LEAD_ADMIN_NOTIFICATION_FALLBACK_LOCALE = "lt";
    mocks.find.mockResolvedValueOnce({ docs: [] });

    const response = await POST(request("kunde@example.no"));

    expect(response.status).toBe(200);
    expect(mocks.operationalNotice).toHaveBeenCalledWith(
      "admin_notification_language_fallback",
      expect.objectContaining({
        count: 1,
        fallbackLocale: "lt",
        reason: "matching_active_admin_profile_missing_or_invalid",
      }),
    );
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining(
          "Vidinis administratoriaus pranešimas",
        ),
      }),
    );
  });

  it("records a profile lookup failure before using the configured fallback", async () => {
    process.env.RESEND_API_KEY = "resend-key";
    process.env.LEAD_TO_EMAIL = "owner@example.no";
    mocks.find.mockRejectedValueOnce(new Error("profile database unavailable"));

    const response = await POST(request("kunde@example.no"));

    expect(response.status).toBe(200);
    expect(mocks.operationalNotice).toHaveBeenCalledWith(
      "admin_notification_language_fallback",
      expect.objectContaining({ reason: "profile_lookup_failed" }),
    );
  });

  it("sends separate localized notifications to multiple configured administrators", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    process.env.RESEND_API_KEY = "preview-resend-key";
    process.env.PREVIEW_EMAIL_RECIPIENT_ALLOWLIST =
      "no@example.no,lt@example.no";
    process.env.LEAD_TO_EMAIL = "no@example.no,lt@example.no";
    mocks.find.mockResolvedValueOnce({
      docs: [
        {
          active: true,
          email: "no@example.no",
          interfaceLanguage: "nb",
          role: "admin",
        },
        {
          active: true,
          email: "lt@example.no",
          interfaceLanguage: "lt",
          role: "admin",
        },
      ],
    });

    const response = await POST(request("kunde@example.no"));

    expect(response.status).toBe(200);
    expect(mocks.resendSend).toHaveBeenCalledTimes(2);
    expect(mocks.resendSend.mock.calls.map(([message]) => message.to)).toEqual([
      "no@example.no",
      "lt@example.no",
    ]);
    expect(
      mocks.resendSend.mock.calls.map(([message]) => message.subject),
    ).toEqual([
      expect.stringContaining("Internt adminvarsel"),
      expect.stringContaining("Vidinis administratoriaus pranešimas"),
    ]);
  });

  it("rejects an email string submitted as a phone number", async () => {
    const response = await POST(requestWithBody({ phone: "kunde@example.no" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid payload" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("preserves an email-only submission", async () => {
    const response = await POST(requestWithBody({ email: "kunde@example.no" }));

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "kunde@example.no",
          preferredChannel: "email",
        }),
      }),
    );
  });

  it("stores non-duplicated address parts and only server-sourced coordinates for a matched Kartverket selection", async () => {
    const response = await POST(
      requestWithBody({
        phone: "+47 900 00 000",
        address: "Testveien 1",
        addressSelection: {
          provider: "kartverket-address-rest-v1",
          providerAddressId: "0301-1-2-0-0-Testveien 1",
          canonicalLabel: "Testveien 1, 1182 OSLO",
          streetAddress: "Testveien 1",
          postalCode: "1182",
          city: "OSLO",
          latitude: 1,
          longitude: 2,
        },
      }),
    );

    expect(response.status).toBe(200);
    const createInput = mocks.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createInput.data).toMatchObject({
      address: "Testveien 1",
      postal: "1182",
      city: "OSLO",
      addressVerificationStatus: "verified",
      addressVerificationProvider: "kartverket-address-rest-v1",
      addressVerificationProviderId: "0301-1-2-0-0-Testveien 1",
      addressLatitude: 59.8901,
      addressLongitude: 10.7901,
    });
    expect(createInput.data).not.toHaveProperty("addressSelection");
    expect(String(createInput.data.address)).not.toContain("1182");
    expect(createInput.data.addressLatitude).not.toBe(1);
    expect(createInput.data.addressLongitude).not.toBe(2);
  });

  it("rejects a selected address whose postal code conflicts with the separately entered value", async () => {
    const response = await POST(
      requestWithBody({
        phone: "90000000",
        address: "Testveien 1",
        addressSelection: {
          provider: "kartverket-address-rest-v1",
          providerAddressId: "0301-1-2-0-0-Testveien 1",
          canonicalLabel: "Testveien 1, 1182 OSLO",
          streetAddress: "Testveien 1",
          postalCode: "9999",
          city: "OSLO",
          latitude: 59.8901,
          longitude: 10.7901,
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("downgrades a stale or tampered provider identity to unverified manual data", async () => {
    mocks.searchAddress.mockResolvedValueOnce([]);

    const response = await POST(
      requestWithBody({
        phone: "90000000",
        address: "Testveien 1",
        addressSelection: {
          provider: "kartverket-address-rest-v1",
          providerAddressId: "tampered-id",
          canonicalLabel: "Testveien 1, 1182 OSLO",
          streetAddress: "Testveien 1",
          postalCode: "1182",
          city: "OSLO",
          latitude: 1,
          longitude: 2,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          address: "Testveien 1",
          addressVerificationStatus: "verification_failed",
          addressVerificationProvider: null,
          addressVerificationProviderId: null,
          addressLatitude: null,
          addressLongitude: null,
          addressVerifiedAt: null,
        }),
      }),
    );
  });
});
