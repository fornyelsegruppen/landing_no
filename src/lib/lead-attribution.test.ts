import { describe, expect, it } from "vitest";
import {
  captureLeadAttribution,
  readContentSource,
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
