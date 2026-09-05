import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: navigation.notFound,
  usePathname: () => "/admin-next-r4-fixture",
  useRouter: () => ({ refresh: () => undefined }),
}));

import AdminNextR4VisualFixture from "./page";

describe("Admin Next R4 mutation visual fixture", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_NEXT_VISUAL_FIXTURE", "true");
    navigation.notFound.mockClear();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("renders only allowlisted states with the real integrated mutation controls", async () => {
    const addressElement = await AdminNextR4VisualFixture({
      searchParams: Promise.resolve({ state: "address_review" }),
    });
    const addressHtml = renderToStaticMarkup(addressElement);

    expect(addressHtml).toContain('data-r4-mutation-fixture="address_review"');
    expect(addressHtml).toContain('data-address-correction-control="true"');
    expect(addressHtml).toContain("Taisyti bylos adresą");
    expect(addressHtml).toContain("Sintetiniai Preview duomenys");
    expect(addressHtml).not.toContain('data-rf-offer-bridge="open-review"');

    const offerElement = await AdminNextR4VisualFixture({
      searchParams: Promise.resolve({ state: "offer_review" }),
    });
    const offerHtml = renderToStaticMarkup(offerElement);

    expect(offerHtml).toContain('data-r4-mutation-fixture="offer_review"');
    expect(offerHtml).toContain('data-rf-offer-bridge="open-review"');
    expect(offerHtml).toContain("Įkelti matavimą į pasiūlymą");
    expect(offerHtml).toContain("Sintetiniai Preview duomenys");

    await expect(
      AdminNextR4VisualFixture({
        searchParams: Promise.resolve({ state: "not-allowlisted" }),
      }),
    ).rejects.toThrow("not-found");
  });

  it("is inaccessible when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(
      AdminNextR4VisualFixture({
        searchParams: Promise.resolve({ state: "address_review" }),
      }),
    ).rejects.toThrow("not-found");
    expect(navigation.notFound).toHaveBeenCalledTimes(1);
  });

  it("is inaccessible without the explicit visual-fixture gate", async () => {
    vi.stubEnv("ADMIN_NEXT_VISUAL_FIXTURE", "false");

    await expect(
      AdminNextR4VisualFixture({
        searchParams: Promise.resolve({ state: "offer_review" }),
      }),
    ).rejects.toThrow("not-found");
  });
});
