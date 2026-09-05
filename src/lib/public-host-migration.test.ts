import { describe, expect, it } from "vitest";
import {
  canonicalLegacyDestination,
  publicHostRedirectTarget,
} from "./public-host-migration";

describe("public host migration", () => {
  it.each(["takfornyelse.as", "www.takfornyelse.as"])(
    "redirects public %s GET in one hop while preserving path and query",
    (host) => {
      const target = publicHostRedirectTarget({
        url: `https://${host}/no/takvask?utm_source=test&gclid=abc`,
        method: "GET",
        enabled: true,
      });

      expect(target?.toString()).toBe(
        "https://takfornyelsenorge.no/no/takvask?utm_source=test&gclid=abc",
      );
    },
  );

  it("redirects the new www host to the canonical apex", () => {
    const target = publicHostRedirectTarget({
      url: "https://www.takfornyelsenorge.no/en?ref=www",
      method: "HEAD",
      enabled: false,
    });

    expect(target?.toString()).toBe("https://takfornyelsenorge.no/en?ref=www");
  });

  it.each([
    "/api/lead",
    "/api/webhooks/resend",
    "/admin",
    "/admin-v2/cases",
    "/user/login",
    "/payload/graphql",
    "/media/file.jpg",
    "/_next/static/chunk.js",
  ])("keeps operational path %s on the old host", (pathname) => {
    expect(
      publicHostRedirectTarget({
        url: `https://www.takfornyelse.as${pathname}?signature=keep`,
        method: "GET",
        enabled: true,
      }),
    ).toBeNull();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "never redirects %s requests",
    (method) => {
      expect(
        publicHostRedirectTarget({
          url: "https://www.takfornyelse.as/no",
          method,
          enabled: true,
        }),
      ).toBeNull();
    },
  );

  it("keeps legacy redirects disabled for the pre-cutover candidate", () => {
    expect(
      publicHostRedirectTarget({
        url: "https://www.takfornyelse.as/no",
        method: "GET",
        enabled: false,
      }),
    ).toBeNull();
  });

  it("makes relative legacy redirects canonical only in the enabled deployment", () => {
    expect(canonicalLegacyDestination("/no#kontakt", false)).toBe(
      "/no#kontakt",
    );
    expect(canonicalLegacyDestination("/no#kontakt", true)).toBe(
      "https://takfornyelsenorge.no/no#kontakt",
    );
    expect(
      canonicalLegacyDestination(
        "https://fornyelsegruppen.no/tjenester/fjerning-av-taksno",
        true,
      ),
    ).toBe("https://fornyelsegruppen.no/tjenester/fjerning-av-taksno");
  });
});
