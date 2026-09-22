import { describe, expect, it } from "vitest";
import {
  captureLeadAttribution,
  clearLeadAcquisition,
  readContentSource,
  rememberLeadAcquisition,
  resolveLeadAcquisition,
  storeContentSource,
} from "@/lib/lead-attribution";

describe("captureLeadAttribution", () => {
  it("captures advertising parameters and the initial landing context", () => {
    expect(
      captureLeadAttribution(
        "https://www.takfornyelse.as/no?utm_source=meta&utm_medium=paid_social&utm_campaign=august&utm_content=for_etter&fbclid=abc#referanser",
        "https://www.facebook.com/",
      ),
    ).toEqual({
      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: "august",
      utmContent: "for_etter",
      fbclid: "abc",
      landingPage:
        "https://www.takfornyelse.as/no?utm_source=meta&utm_medium=paid_social&utm_campaign=august&utm_content=for_etter&fbclid=abc#referanser",
      referrer: "https://www.facebook.com/",
    });
  });

  it("does not add empty attribution values", () => {
    expect(captureLeadAttribution("https://www.takfornyelse.as/no")).toEqual({
      landingPage: "https://www.takfornyelse.as/no",
      referrer: undefined,
    });
  });
});

describe("advertising acquisition across internal navigation", () => {
  function sessionStore() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  }
  const contact = captureLeadAttribution(
    "https://takfornyelsenorge.no/no#kontakt",
  );
  const acquisition = captureLeadAttribution(
    "https://takfornyelsenorge.no/no/blogg/takvask-pris?utm_source=google&utm_medium=cpc&utm_campaign=roof&utm_content=photo&utm_term=takvask&gclid=google-click&gbraid=ios-gb&wbraid=ios-wb&fbclid=meta-click&msclkid=ms-click",
    "https://www.google.com/",
  );

  it("preserves all UTM/click IDs and original landing/referrer while keeping article provenance", () => {
    const storage = sessionStore();
    rememberLeadAcquisition(storage, acquisition, "granted", 1_000);
    rememberLeadAcquisition(storage, contact, "granted", 2_000);
    const submitted = resolveLeadAcquisition(
      storage,
      { ...contact, contentSourcePath: "/no/blogg/takvask-pris" },
      "granted",
      3_000,
    );

    expect(submitted).toEqual({
      ...acquisition,
      contentSourcePath: "/no/blogg/takvask-pris",
    });
  });

  it("lets a new explicit paid landing supersede the earlier acquisition", () => {
    const storage = sessionStore();
    rememberLeadAcquisition(storage, acquisition, "granted", 1_000);
    const next = captureLeadAttribution(
      "https://takfornyelsenorge.no/no/takmaling?utm_source=meta&fbclid=next-click",
    );
    expect(resolveLeadAcquisition(storage, next, "granted", 2_000)).toEqual(
      next,
    );
    rememberLeadAcquisition(storage, next, "granted", 2_000);
    expect(resolveLeadAcquisition(storage, contact, "granted", 3_000)).toEqual(
      next,
    );
  });

  it.each(["unknown", "denied"] as const)(
    "does not persist or reuse optional session acquisition with %s consent",
    (consent) => {
      const storage = sessionStore();
      rememberLeadAcquisition(storage, acquisition, consent, 1_000);
      expect(
        resolveLeadAcquisition(storage, contact, "granted", 2_000),
      ).toEqual(contact);
      rememberLeadAcquisition(storage, acquisition, "granted", 3_000);
      expect(resolveLeadAcquisition(storage, contact, consent, 4_000)).toEqual(
        contact,
      );
      clearLeadAcquisition(storage);
      expect(
        resolveLeadAcquisition(storage, contact, "granted", 4_000),
      ).toEqual(contact);
    },
  );

  it("expires after 30 minutes without ordinary navigation extending the stored acquisition", () => {
    const storage = sessionStore();
    rememberLeadAcquisition(storage, acquisition, "granted", 1_000);
    rememberLeadAcquisition(storage, contact, "granted", 20 * 60 * 1_000);
    expect(
      resolveLeadAcquisition(storage, contact, "granted", 31 * 60 * 1_000),
    ).toEqual(contact);
  });

  it("does not reuse an acquisition recorded for another origin", () => {
    const storage = sessionStore();
    rememberLeadAcquisition(storage, acquisition, "granted", 1_000);
    const other = captureLeadAttribution("https://preview.example/no");
    expect(resolveLeadAcquisition(storage, other, "granted", 2_000)).toEqual(
      other,
    );
  });

  it("keeps separately captured click IDs even when the landing URL is truncated", () => {
    const storage = sessionStore();
    const longLanding = captureLeadAttribution(
      `https://takfornyelsenorge.no/no?utm_content=${"x".repeat(1_100)}&gclid=retain-me`,
    );
    expect(longLanding.landingPage).toHaveLength(1_000);
    rememberLeadAcquisition(storage, longLanding, "granted", 1_000);
    expect(
      resolveLeadAcquisition(storage, contact, "granted", 2_000).gclid,
    ).toBe("retain-me");
  });

  it("falls back to current form attribution when session storage is malformed or unavailable", () => {
    for (const getItem of [
      () => "{broken",
      () => {
        throw new Error("blocked");
      },
    ]) {
      const storage = {
        getItem,
        setItem: () => {
          throw new Error("blocked");
        },
      };
      expect(() =>
        rememberLeadAcquisition(storage, acquisition, "granted", 1_000),
      ).not.toThrow();
      expect(
        resolveLeadAcquisition(storage, contact, "granted", 2_000),
      ).toEqual(contact);
    }
  });
});

describe("article lead attribution", () => {
  it("keeps a recent article source without replacing acquisition UTM", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(storeContentSource(storage, "/no/blogg/takvask-pris", 1_000)).toBe(
      true,
    );
    const source = readContentSource(storage, 2_000);

    expect(
      captureLeadAttribution(
        "https://takfornyelse.as/no?utm_source=google",
        "https://google.no/",
        source,
      ),
    ).toMatchObject({
      utmSource: "google",
      contentSourcePath: "/no/blogg/takvask-pris",
    });
  });

  it("rejects forged and expired content sources", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(storeContentSource(storage, "https://evil.example/", 1_000)).toBe(
      false,
    );
    storeContentSource(storage, "/en/blogg/roof-guide", 1_000);
    expect(readContentSource(storage, 31 * 60 * 1000)).toBeUndefined();
    expect(
      captureLeadAttribution(
        "https://takfornyelse.as/no",
        "",
        "https://evil.example/",
      ),
    ).not.toHaveProperty("contentSourcePath");
  });
});
