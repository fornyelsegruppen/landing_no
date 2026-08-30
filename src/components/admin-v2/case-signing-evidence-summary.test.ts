import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CaseDocument } from "@/lib/admin-v2/case-read-model";
import type { CaseCommercialVersion } from "@/lib/admin-v2/case-commercial-context";
import {
  caseChangeDocumentHref,
  caseContractDocumentHref,
  CaseSigningEvidenceSummary,
  resolveCaseSigningEvidence,
} from "./case-signing-evidence-summary";

const effectiveContract: CaseCommercialVersion = {
  companySignedAt: "2026-08-30T09:10:00.000Z",
  createdAt: "2026-08-30T08:00:00.000Z",
  id: 41,
  kind: "contract",
  pdfHref: "/api/admin/media/501",
  quoteId: 31,
  reference: "K-19-V1",
  role: "effective",
  signedAt: "2026-08-30T09:00:00.000Z",
  status: "signed",
  technicalHref: "/admin/collections/contracts/41",
  version: 1,
};

const change = {
  acceptedAt: "2026-08-30T10:30:00.000Z",
  createdAt: "2026-08-30T10:00:00.000Z",
  href: "/admin/collections/change-agreements/6",
  id: 6,
  reference: "E-6-V1",
  status: "accepted",
  workOrderId: 19,
};

const documents: CaseDocument[] = [
  {
    filename: "endelig-signert-k-19-v1.pdf",
    href: "/api/admin/media/501",
    id: 501,
    mimeType: "application/pdf",
    ownerId: "41",
    ownerType: "contract",
  },
  {
    filename: "E-6-V1-akseptert.pdf",
    href: "/api/admin/media/601",
    id: 601,
    mimeType: "application/pdf",
    ownerId: "6",
    ownerType: "change-agreement",
  },
];

const formatDate = (value?: string) =>
  value ? `DATE:${value.slice(11, 16)}` : "—";

describe("case signing evidence summary", () => {
  it("shows the effective fully signed contract and accepted change with durable media links", () => {
    const html = renderToStaticMarkup(
      createElement(CaseSigningEvidenceSummary, {
        change,
        documents,
        effectiveContract,
        formatDate,
        locale: "lt",
      }),
    );

    expect(html).toContain("Originali galiojanti sutartis");
    expect(html).toContain("K-19-V1");
    expect(html).toContain("Pasirašyta abiejų šalių");
    expect(html).toContain('href="/api/admin/media/501"');
    expect(html).toContain("E-6-V1");
    expect(html).toContain("Elektroniškai priimta");
    expect(html).toContain(
      "Vardas, laikas ir dokumento kontrolė pateikti PDF įrodyme.",
    );
    expect(html).toContain('href="/api/admin/media/601"');
    expect(html).toContain("DATE:09:00");
    expect(html).toContain("DATE:09:10");
    expect(html).toContain("DATE:10:30");
    expect(html).not.toContain("/api/admin/quotes/");
    expect(html).not.toContain("/api/admin/change-agreements/6/pdf");
  });

  it("does not claim both-party proof when the effective contract resolves to the customer-signed PDF", () => {
    const customerSignedDocument: CaseDocument = {
      filename: "signert-k-19-v1.pdf",
      href: "/api/admin/media/502",
      id: 502,
      mimeType: "application/pdf",
      ownerId: "41",
      ownerType: "contract",
    };
    const html = renderToStaticMarkup(
      createElement(CaseSigningEvidenceSummary, {
        documents: [customerSignedDocument],
        effectiveContract: {
          ...effectiveContract,
          pdfHref: customerSignedDocument.href,
        },
        formatDate,
        locale: "lt",
      }),
    );

    expect(html).toContain("PDF įrodymas nerastas");
    expect(html).not.toContain("Pasirašyta abiejų šalių");
    expect(html).not.toContain('href="/api/admin/media/502"');
  });

  it("rejects regeneration endpoints and keeps compact phone-safe wrapping", () => {
    const resolved = resolveCaseSigningEvidence({
      change,
      documents,
      effectiveContract: {
        ...effectiveContract,
        pdfHref: "/api/admin/quotes/31/pdf",
      },
    });
    expect(resolved.fullySignedContractDocument).toBeUndefined();
    expect(
      caseContractDocumentHref(
        {
          ...effectiveContract,
          pdfHref: "/api/admin/quotes/31/pdf",
        },
        documents,
      ),
    ).toBeUndefined();
    expect(caseContractDocumentHref(effectiveContract, documents)).toBe(
      "/api/admin/media/501",
    );
    expect(
      caseContractDocumentHref(
        {
          ...effectiveContract,
          pdfHref: "/api/admin/media/502",
        },
        [
          {
            filename: "signert-k-19-v1.pdf",
            href: "/api/admin/media/502",
            id: 502,
            mimeType: "application/pdf",
            ownerId: "41",
            ownerType: "contract",
          },
        ],
      ),
    ).toBeUndefined();
    expect(
      caseContractDocumentHref(
        {
          ...effectiveContract,
          companySignedAt: undefined,
          pdfHref: "/api/admin/media/502",
        },
        [
          {
            filename: "signert-k-19-v1.pdf",
            href: "/api/admin/media/502",
            id: 502,
            mimeType: "application/pdf",
            ownerId: "41",
            ownerType: "contract",
          },
        ],
      ),
    ).toBe("/api/admin/media/502");
    expect(caseChangeDocumentHref(change, documents)).toBe(
      "/api/admin/media/601",
    );
    expect(
      caseChangeDocumentHref(change, documents.slice(0, 1)),
    ).toBeUndefined();
    expect(
      caseChangeDocumentHref({ ...change, status: "approved" }, documents),
    ).toBe("/api/admin/change-agreements/6/pdf");

    const html = renderToStaticMarkup(
      createElement(CaseSigningEvidenceSummary, {
        change,
        documents,
        effectiveContract,
        formatDate,
        locale: "nb",
      }),
    );
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("[overflow-wrap:anywhere]");
    expect(html).toContain("min-h-11");
  });

  it("shows an explicit warning when an accepted change has no durable accepted PDF", () => {
    const html = renderToStaticMarkup(
      createElement(CaseSigningEvidenceSummary, {
        change,
        documents: documents.slice(0, 1),
        formatDate,
        locale: "en",
      }),
    );

    expect(html).toContain("E-6-V1");
    expect(html).toContain("Acceptance PDF evidence was not found");
    expect(html).not.toContain("Open accepted change agreement PDF");
  });
});
