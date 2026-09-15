import { Children, isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const hooks = vi.hoisted(() => ({
  choice: null as "granted" | "denied" | null,
  settingsOpen: false,
  stateIndex: 0,
  pathname: "/no",
  ref: { current: null as unknown },
  effects: [] as Array<() => void | (() => void)>,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
  useState: () => [
    hooks.stateIndex++ === 0 ? hooks.choice : hooks.settingsOpen,
    vi.fn(),
  ],
  useRef: () => hooks.ref,
}));
vi.mock("next-intl", () => ({ useLocale: () => "no" }));
vi.mock("next/navigation", () => ({ usePathname: () => hooks.pathname }));
vi.mock("@/i18n/routing", () => ({ Link: "a" }));

import {
  MarketingAnalytics,
  getMarketingConsentChoice,
  trackArticleCtaClick,
  trackLeadConversion,
  trackLeadFormEvent,
} from "./marketing-analytics";
import {
  captureLeadAttribution,
  resolveLeadAcquisition,
} from "@/lib/lead-attribution";

const CONSENT_KEY = "takfornyelse_marketing_consent";
const PENDING_KEY = "takfornyelse_pending_lead_conversion";
const SENT_PREFIX = "takfornyelse_sent_ga4_lead:";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

let consentStorage: ReturnType<typeof memoryStorage>;
let sessionStorage: ReturnType<typeof memoryStorage>;
let google: Mock<(...args: unknown[]) => void>;
let meta: ReturnType<typeof vi.fn>;
let appendScript: ReturnType<typeof vi.fn>;

function renderAnalytics(
  choice: "granted" | "denied" | null,
  pathname = "/no",
  settingsOpen = false,
) {
  hooks.choice = choice;
  hooks.pathname = pathname;
  hooks.settingsOpen = settingsOpen;
  hooks.stateIndex = 0;
  hooks.effects = [];
  const element = MarketingAnalytics();
  hooks.effects.forEach((effect) => effect());
  return element;
}

function googleEvents(name: string) {
  return google.mock.calls.filter(
    (call) => call[0] === "event" && call[1] === name,
  );
}

function pendingLead() {
  return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null") as {
    eventId: string;
    inquiryType: string;
    at: number;
  } | null;
}

function clickButton(node: ReactNode, label: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child))
      continue;
    if (child.type === "button" && child.props.children === label) {
      child.props.onClick?.();
      return true;
    }
    if (clickButton(child.props.children, label)) return true;
  }
  return false;
}

beforeEach(() => {
  vi.restoreAllMocks();
  hooks.ref.current = null;
  consentStorage = memoryStorage();
  sessionStorage = memoryStorage();
  google = vi.fn();
  meta = vi.fn();
  appendScript = vi.fn();
  vi.stubGlobal("window", {
    localStorage: consentStorage,
    sessionStorage,
    gtag: google,
    fbq: meta,
    location: { href: "https://takfornyelsenorge.no/no" },
    setTimeout: vi.fn(),
    clearTimeout: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", {
    querySelector: vi.fn(() => null),
    createElement: vi.fn(() => ({ dataset: {} })),
    head: { appendChild: appendScript },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe("advertising consent", () => {
  it.each([null, "denied"] as const)(
    "loads no measurement scripts and emits no explicit events with %s consent",
    (choice) => {
      if (choice) consentStorage.setItem(CONSENT_KEY, choice);
      renderAnalytics(choice);
      trackArticleCtaClick("takvask-pris");
      trackLeadFormEvent("lead_form_start", { step: 1 });
      trackLeadConversion({ inquiryType: "takvask", persistedLeadId: 55 });

      expect(appendScript).not.toHaveBeenCalled();
      expect(google).not.toHaveBeenCalled();
      expect(meta).not.toHaveBeenCalled();
      if (choice === "denied") expect(pendingLead()).toBeNull();
    },
  );

  it("initializes the existing tags after consent and uses the new page location", () => {
    consentStorage.setItem(CONSENT_KEY, "granted");
    renderAnalytics("granted");

    expect(appendScript.mock.calls.map(([script]) => script.src)).toEqual([
      "https://www.googletagmanager.com/gtag/js?id=G-ENMB8696J8",
      "https://connect.facebook.net/en_US/fbevents.js",
    ]);
    expect(google.mock.calls[0]).toMatchObject([
      "consent",
      "default",
      { ad_storage: "denied", analytics_storage: "denied" },
    ]);
    expect(google).toHaveBeenCalledWith(
      "config",
      "AW-18213788044",
      expect.any(Object),
    );
    expect(meta).toHaveBeenCalledWith("init", "1015457044803165");
    expect(googleEvents("page_view")[0][2]).toMatchObject({
      page_location: "https://takfornyelsenorge.no/no",
    });
  });

  it("revokes initialized tags, discards pending conversion, and blocks later explicit events", () => {
    consentStorage.setItem(CONSENT_KEY, "granted");
    trackLeadConversion({ persistedLeadId: 55 });
    expect(pendingLead()).not.toBeNull();
    const settings = renderAnalytics("granted", "/no", true);
    google.mockClear();
    meta.mockClear();

    expect(clickButton(settings, "Avslå")).toBe(true);
    expect(getMarketingConsentChoice()).toBe("denied");
    expect(pendingLead()).toBeNull();
    expect(google).toHaveBeenCalledWith(
      "consent",
      "update",
      expect.objectContaining({
        ad_storage: "denied",
        analytics_storage: "denied",
      }),
    );
    expect(meta).toHaveBeenCalledWith("consent", "revoke");

    google.mockClear();
    meta.mockClear();
    trackLeadConversion({ persistedLeadId: 55 });
    trackLeadFormEvent("lead_form_submit_attempt");
    trackArticleCtaClick("takvask-pris");
    expect(google).not.toHaveBeenCalled();
    expect(meta).not.toHaveBeenCalled();
  });

  it("fails closed when saved consent cannot be read", () => {
    consentStorage.getItem.mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(getMarketingConsentChoice()).toBe("unknown");
    expect(() => renderAnalytics(null)).not.toThrow();
    trackLeadConversion({ persistedLeadId: 55 });
    expect(google).not.toHaveBeenCalled();
    expect(meta).not.toHaveBeenCalled();
  });

  it("keeps navigation and consent withdrawal working when the sessionStorage getter throws", () => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => {
        throw new Error("Storage unavailable");
      },
    });
    expect(() => renderAnalytics(null)).not.toThrow();
    consentStorage.setItem(CONSENT_KEY, "denied");
    expect(() => renderAnalytics("denied")).not.toThrow();
    consentStorage.setItem(CONSENT_KEY, "granted");
    const settings = renderAnalytics("granted", "/no", true);
    google.mockClear();
    meta.mockClear();
    expect(() => clickButton(settings, "Avslå")).not.toThrow();
    expect(google).toHaveBeenCalledWith(
      "consent",
      "update",
      expect.objectContaining({ ad_storage: "denied" }),
    );
    expect(meta).toHaveBeenCalledWith("consent", "revoke");
  });

  it("keeps the paid landing in memory until consent, then restores it for the contact form", () => {
    window.location.href =
      "https://takfornyelsenorge.no/no/blogg/takvask-pris?utm_source=google&gclid=first-click";
    renderAnalytics(null, "/no/blogg/takvask-pris");
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
    window.location.href = "https://takfornyelsenorge.no/no#kontakt";
    renderAnalytics(null, "/no");
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
    consentStorage.setItem(CONSENT_KEY, "granted");
    renderAnalytics("granted", "/no");

    const attribution = resolveLeadAcquisition(
      sessionStorage,
      captureLeadAttribution(window.location.href),
      "granted",
    );
    expect(attribution).toMatchObject({
      utmSource: "google",
      gclid: "first-click",
      landingPage:
        "https://takfornyelsenorge.no/no/blogg/takvask-pris?utm_source=google&gclid=first-click",
    });
  });
});

describe("successful lead recovery", () => {
  it("does not count a silent honeypot success without a persisted lead ID", () => {
    consentStorage.setItem(CONSENT_KEY, "granted");
    trackLeadConversion({ inquiryType: "takvask" });
    expect(google).not.toHaveBeenCalled();
    expect(meta).not.toHaveBeenCalled();
    expect(pendingLead()).toBeNull();
    trackLeadConversion({ inquiryType: "takvask", persistedLeadId: 55 });
    expect(googleEvents("generate_lead")).toHaveLength(1);
    expect(googleEvents("conversion")).toHaveLength(1);
  });

  it("sends each GA4 event once while Ads/Meta recovery keeps the same deduplication IDs", () => {
    consentStorage.setItem(CONSENT_KEY, "granted");
    trackLeadConversion({ inquiryType: "takvask", persistedLeadId: 55 });
    const pending = pendingLead();
    expect(pending).not.toBeNull();
    renderAnalytics("granted", "/no/takk");
    renderAnalytics("granted", "/no/takk");

    expect(googleEvents("generate_lead")).toHaveLength(1);
    expect(googleEvents("manual_event_SUBMIT_LEAD_FORM")).toHaveLength(1);
    expect(googleEvents("conversion")).toHaveLength(2);
    expect(googleEvents("conversion").map((call) => call[2])).toEqual([
      expect.objectContaining({
        send_to: "AW-18213788044/oHJeCIutstUcEIyzge1D",
        transaction_id: pending?.eventId,
      }),
      expect.objectContaining({
        send_to: "AW-18213788044/oHJeCIutstUcEIyzge1D",
        transaction_id: pending?.eventId,
      }),
    ]);
    expect(
      meta.mock.calls
        .filter((call) => call[0] === "track" && call[1] === "Lead")
        .map((call) => call[3]),
    ).toEqual([{ eventID: pending?.eventId }, { eventID: pending?.eventId }]);
    expect(pendingLead()).toBeNull();

    trackLeadConversion({ inquiryType: "nytt_tak", persistedLeadId: 56 });
    renderAnalytics("granted", "/no/takk");
    expect(googleEvents("generate_lead")).toHaveLength(2);
    expect(googleEvents("generate_lead")[1][2]).not.toMatchObject({
      lead_event_id: pending?.eventId,
    });
  });

  it("honors the persisted GA4 marker after a page reload", () => {
    consentStorage.setItem(CONSENT_KEY, "granted");
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        eventId: "previous-page-event",
        inquiryType: "takvask",
        at: Date.now(),
      }),
    );
    sessionStorage.setItem(`${SENT_PREFIX}previous-page-event`, "sent");
    renderAnalytics("granted", "/no/takk");

    expect(googleEvents("generate_lead")).toHaveLength(0);
    expect(googleEvents("manual_event_SUBMIT_LEAD_FORM")).toHaveLength(0);
    expect(googleEvents("conversion")).toHaveLength(1);
  });

  it("recovers a recent successful submission after consent is first granted on confirmation", () => {
    trackLeadConversion({ inquiryType: "takvask", persistedLeadId: 55 });
    const pending = pendingLead();
    expect(google).not.toHaveBeenCalled();
    expect(meta).not.toHaveBeenCalled();
    consentStorage.setItem(CONSENT_KEY, "granted");
    renderAnalytics("granted", "/no/takk");

    expect(googleEvents("generate_lead")).toHaveLength(1);
    expect(googleEvents("generate_lead")[0][2]).toMatchObject({
      lead_event_id: pending?.eventId,
    });
    expect(googleEvents("conversion")).toHaveLength(1);
    expect(pendingLead()).toBeNull();
  });

  it("does not claim GA4 delivery before the Google function is available", () => {
    consentStorage.setItem(CONSENT_KEY, "granted");
    window.gtag = undefined;
    trackLeadConversion({ persistedLeadId: 55 });
    window.gtag = (...args) => google(...args);
    renderAnalytics("granted", "/no/takk");
    expect(googleEvents("generate_lead")).toHaveLength(1);
  });

  it("does not convert a direct confirmation-page visit or an expired pending lead", () => {
    consentStorage.setItem(CONSENT_KEY, "granted");
    renderAnalytics("granted", "/no/takk");
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        eventId: "expired-event",
        at: Date.now() - 16 * 60 * 1000,
      }),
    );
    renderAnalytics("granted", "/no/takk");

    expect(googleEvents("generate_lead")).toHaveLength(0);
    expect(googleEvents("conversion")).toHaveLength(0);
    expect(
      meta.mock.calls.some((call) => call[0] === "track" && call[1] === "Lead"),
    ).toBe(false);
    expect(pendingLead()).toBeNull();
  });
});
