import type { Metadata } from "next";
import type { ReactNode } from "react";

const facebookDomainVerification =
  process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION?.trim();

export const metadata: Metadata = {
  other: facebookDomainVerification
    ? { "facebook-domain-verification": facebookDomainVerification }
    : undefined,
};

// Payload admin provides its own <html>/<body>. Site layout does too.
// Root must only pass children to avoid nested-document SSR crashes.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
