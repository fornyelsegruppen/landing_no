import { describe, expect, it } from "vitest";
import {
  adminNotificationFallbackLocale,
  parseAdminNotificationRecipients,
  resolveAdminNotificationRecipients,
} from "./lead-admin-notification-recipient";

describe("lead admin notification recipients", () => {
  it("uses an active administrator's persisted profile language", () => {
    expect(
      resolveAdminNotificationRecipients({
        configuredRecipients: "owner@example.no",
        profiles: [
          {
            active: true,
            email: "OWNER@example.no",
            interfaceLanguage: "lt",
            role: "admin",
          },
        ],
      }),
    ).toEqual([
      {
        email: "owner@example.no",
        locale: "lt",
        localeSource: "admin_profile",
        to: "owner@example.no",
      },
    ]);
  });

  it("reflects a changed saved preference on the next resolution", () => {
    const base = {
      active: true,
      email: "owner@example.no",
      role: "admin",
    } as const;
    const resolve = (interfaceLanguage: "lt" | "nb") =>
      resolveAdminNotificationRecipients({
        configuredRecipients: base.email,
        profiles: [{ ...base, interfaceLanguage }],
      })[0]?.locale;

    expect(resolve("lt")).toBe("lt");
    expect(resolve("nb")).toBe("nb");
  });

  it("uses the explicit fallback when no matching admin profile exists", () => {
    expect(
      resolveAdminNotificationRecipients({
        configuredRecipients: "archive@example.no",
        fallbackLocale: "en",
        profiles: [],
      })[0],
    ).toMatchObject({ locale: "en", localeSource: "fallback" });
    expect(adminNotificationFallbackLocale({})).toBe("nb");
    expect(
      adminNotificationFallbackLocale({
        LEAD_ADMIN_NOTIFICATION_FALLBACK_LOCALE: "lt",
      }),
    ).toBe("lt");
  });

  it("resolves each configured administrator independently", () => {
    expect(
      resolveAdminNotificationRecipients({
        configuredRecipients:
          "Norway <no@example.no>, LT <lt@example.no>, no@example.no",
        fallbackLocale: "en",
        profiles: [
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
      }).map(({ email, locale }) => ({ email, locale })),
    ).toEqual([
      { email: "no@example.no", locale: "nb" },
      { email: "lt@example.no", locale: "lt" },
    ]);
  });

  it("ignores invalid destinations and inactive or non-admin profiles", () => {
    expect(parseAdminNotificationRecipients("invalid, owner@example.no")).toEqual(
      [{ email: "owner@example.no", to: "owner@example.no" }],
    );
    expect(
      resolveAdminNotificationRecipients({
        configuredRecipients: "owner@example.no",
        fallbackLocale: "en",
        profiles: [
          {
            active: false,
            email: "owner@example.no",
            interfaceLanguage: "lt",
            role: "admin",
          },
        ],
      })[0]?.localeSource,
    ).toBe("fallback");
  });

  it("uses the explicit fallback for a matching legacy profile with no valid saved locale", () => {
    expect(
      resolveAdminNotificationRecipients({
        configuredRecipients: "owner@example.no",
        fallbackLocale: "lt",
        profiles: [
          {
            active: true,
            email: "owner@example.no",
            interfaceLanguage: null,
            role: "admin",
          },
        ],
      })[0],
    ).toMatchObject({ locale: "lt", localeSource: "fallback" });
  });
});
