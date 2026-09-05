import "server-only";

import type { AddressCandidate, MapProvider } from "@/lib/providers/contracts";
import { KartverketAddressProvider } from "@/lib/providers/kartverket-address-provider";

export const KARTVERKET_ADDRESS_PROVIDER =
  "kartverket-address-rest-v1" as const;

export type AddressSelectionClaim = {
  provider: typeof KARTVERKET_ADDRESS_PROVIDER;
  providerAddressId: string;
  canonicalLabel: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
};

export type LeadAddressVerificationStatus =
  "manual" | "unverified" | "verification_failed" | "verified";

export type LeadAddressVerificationRecord = {
  address?: unknown;
  houseNumber?: unknown;
  postal?: unknown;
  city?: unknown;
  addressVerificationStatus?: unknown;
  addressVerificationProvider?: unknown;
  addressVerificationProviderId?: unknown;
  addressLatitude?: unknown;
  addressLongitude?: unknown;
  addressVerifiedAt?: unknown;
};

function finiteCoordinate(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function resolveKartverketAddressClaim(
  claim: AddressSelectionClaim,
  provider: Pick<
    MapProvider,
    "searchAddress"
  > = new KartverketAddressProvider(),
): Promise<AddressCandidate | null> {
  const candidates = await provider.searchAddress(claim.canonicalLabel);
  return (
    candidates.find(
      (candidate) =>
        candidate.id === claim.providerAddressId &&
        candidate.label === claim.canonicalLabel &&
        candidate.streetAddress === claim.streetAddress &&
        candidate.postalCode === claim.postalCode &&
        candidate.city === claim.city,
    ) || null
  );
}

export function verifiedLeadAddressCandidate(
  lead: LeadAddressVerificationRecord,
): AddressCandidate | null {
  if (
    lead.addressVerificationStatus !== "verified" ||
    lead.addressVerificationProvider !== KARTVERKET_ADDRESS_PROVIDER
  ) {
    return null;
  }
  const providerId = text(lead.addressVerificationProviderId);
  const streetAddress = text(lead.address);
  const houseNumber = text(lead.houseNumber);
  const postalCode = text(lead.postal);
  const city = text(lead.city);
  const verifiedAt = text(lead.addressVerifiedAt);
  if (
    !providerId ||
    !streetAddress ||
    !postalCode ||
    !city ||
    !verifiedAt ||
    !Number.isFinite(Date.parse(verifiedAt)) ||
    !finiteCoordinate(lead.addressLatitude, 57, 72) ||
    !finiteCoordinate(lead.addressLongitude, 4, 32)
  ) {
    return null;
  }
  const fullStreetAddress = [streetAddress, houseNumber]
    .filter(Boolean)
    .join(" ");
  return {
    id: providerId,
    label: `${fullStreetAddress}, ${postalCode} ${city}`,
    streetAddress: fullStreetAddress,
    postalCode,
    city,
    latitude: lead.addressLatitude,
    longitude: lead.addressLongitude,
    source: "Kartverket Matrikkelen Adresse REST API v1 (© Kartverket)",
  };
}

export function clearedAddressVerification(
  status: Exclude<LeadAddressVerificationStatus, "verified">,
) {
  return {
    addressVerificationStatus: status,
    addressVerificationProvider: null,
    addressVerificationProviderId: null,
    addressLatitude: null,
    addressLongitude: null,
    addressVerifiedAt: null,
  } as const;
}

export function verifiedAddressFields(
  candidate: AddressCandidate,
  verifiedAt: Date,
) {
  return {
    addressVerificationStatus: "verified" as const,
    addressVerificationProvider: KARTVERKET_ADDRESS_PROVIDER,
    addressVerificationProviderId: candidate.id,
    addressLatitude: candidate.latitude,
    addressLongitude: candidate.longitude,
    addressVerifiedAt: verifiedAt.toISOString(),
  };
}
