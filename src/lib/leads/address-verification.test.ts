import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  clearedAddressVerification,
  resolveKartverketAddressClaim,
  verifiedAddressFields,
  verifiedLeadAddressCandidate,
} from "./address-verification";

const serverCandidate = {
  id: "0301-1-2-0-0-Testveien 1",
  label: "Testveien 1, 1182 OSLO",
  streetAddress: "Testveien 1",
  postalCode: "1182",
  city: "OSLO",
  latitude: 59.8901,
  longitude: 10.7901,
  source: "Kartverket",
};

const claim = {
  provider: "kartverket-address-rest-v1" as const,
  providerAddressId: serverCandidate.id,
  canonicalLabel: serverCandidate.label,
  streetAddress: serverCandidate.streetAddress,
  postalCode: serverCandidate.postalCode,
  city: serverCandidate.city,
  latitude: 1,
  longitude: 2,
};

describe("lead address verification", () => {
  it("matches identity and address parts server-side without trusting claimed coordinates", async () => {
    const provider = {
      searchAddress: vi.fn().mockResolvedValue([serverCandidate]),
    };

    const resolved = await resolveKartverketAddressClaim(claim, provider);

    expect(resolved).toEqual(serverCandidate);
    expect(resolved?.latitude).toBe(59.8901);
    expect(resolved?.latitude).not.toBe(claim.latitude);
  });

  it("rejects a provider identity or structured-address mismatch", async () => {
    const provider = {
      searchAddress: vi.fn().mockResolvedValue([serverCandidate]),
    };

    await expect(
      resolveKartverketAddressClaim(
        { ...claim, providerAddressId: "tampered" },
        provider,
      ),
    ).resolves.toBeNull();
    await expect(
      resolveKartverketAddressClaim(
        { ...claim, streetAddress: "Other street 9" },
        provider,
      ),
    ).resolves.toBeNull();
  });

  it("projects coordinates only from a complete server-verified record", () => {
    const verifiedAt = new Date("2026-09-05T08:00:00.000Z");
    const record = {
      address: serverCandidate.streetAddress,
      postal: serverCandidate.postalCode,
      city: serverCandidate.city,
      ...verifiedAddressFields(serverCandidate, verifiedAt),
    };

    expect(verifiedLeadAddressCandidate(record)).toMatchObject({
      ...serverCandidate,
      source: expect.stringContaining("Kartverket"),
    });
    expect(
      verifiedLeadAddressCandidate({
        ...record,
        ...clearedAddressVerification("manual"),
      }),
    ).toBeNull();
    expect(
      verifiedLeadAddressCandidate({ ...record, addressVerifiedAt: null }),
    ).toBeNull();
  });
});
