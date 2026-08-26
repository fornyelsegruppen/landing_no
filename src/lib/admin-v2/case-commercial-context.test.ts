import { describe, expect, it } from "vitest";
import { deriveCaseCommercialContext } from "./case-commercial-context";

describe("case commercial context", () => {
  it("keeps V1 effective while V2 waits for the supplier signature", () => {
    const context = deriveCaseCommercialContext(
      [
        { id: 12, reference: "T-15-V2", version: 2, status: "accepted", supersedesId: 10, totalIncVatOre: 1764675 },
        { id: 10, reference: "T-15-V1", version: 1, status: "accepted", totalIncVatOre: 1265963 },
      ],
      [
        { id: 22, quoteId: 12, reference: "K-15-V2", version: 2, status: "signed", supersedesId: 20, signedAt: "2026-08-26T14:00:00Z", signedDocumentId: 92 },
        { id: 20, quoteId: 10, reference: "K-15-V1", version: 1, status: "signed", signedAt: "2026-08-26T10:00:00Z", companySignedAt: "2026-08-26T10:05:00Z", companySignedDocumentId: 90 },
      ],
    );

    expect(context.workingContract).toMatchObject({ reference: "K-15-V2", role: "working" });
    expect(context.effectiveContract).toMatchObject({ reference: "K-15-V1", role: "effective" });
    expect(context.workingContract?.supersedesReference).toBe("K-15-V1");
    expect(context.workingContract?.pdfHref).toBe("/api/admin/media/92");
  });

  it("makes V2 effective only after both parties have signed it", () => {
    const context = deriveCaseCommercialContext(
      [
        { id: 12, reference: "T-15-V2", version: 2, status: "accepted", supersedesId: 10 },
        { id: 10, reference: "T-15-V1", version: 1, status: "accepted" },
      ],
      [
        { id: 22, quoteId: 12, reference: "K-15-V2", version: 2, status: "signed", supersedesId: 20, signedAt: "2026-08-26T14:00:00Z", companySignedAt: "2026-08-26T14:05:00Z", companySignedDocumentId: 93 },
        { id: 20, quoteId: 10, reference: "K-15-V1", version: 1, status: "signed", signedAt: "2026-08-26T10:00:00Z", companySignedAt: "2026-08-26T10:05:00Z", companySignedDocumentId: 90 },
      ],
    );

    expect(context.workingContract).toMatchObject({ reference: "K-15-V2", role: "effective" });
    expect(context.effectiveContract).toMatchObject({ reference: "K-15-V2", role: "effective" });
    expect(context.contractVersions.find((item) => item.reference === "K-15-V1")?.role).toBe("historical");
  });

  it("keeps the old signed contract effective but not working while a newer quote is prepared", () => {
    const context = deriveCaseCommercialContext(
      [
        { id: 20, reference: "T-15-V2", version: 2, status: "draft", supersedesId: 10 },
        { id: 10, reference: "T-15-V1", version: 1, status: "accepted" },
      ],
      [
        {
          id: 11,
          quoteId: 10,
          reference: "K-15-V1",
          version: 1,
          status: "signed",
          signedAt: "2026-08-25T08:00:00Z",
          companySignedAt: "2026-08-25T08:10:00Z",
        },
      ],
    );

    expect(context.workingQuote?.reference).toBe("T-15-V2");
    expect(context.workingContract).toBeUndefined();
    expect(context.effectiveContract?.reference).toBe("K-15-V1");
  });

  it("prefers the accepted quote in the newest option group", () => {
    const context = deriveCaseCommercialContext(
      [
        { id: 14, reference: "T-7-V2-B", version: 2, status: "viewed" },
        { id: 13, reference: "T-7-V2-A", version: 2, status: "accepted" },
        { id: 10, reference: "T-7-V1", version: 1, status: "accepted" },
      ],
      [{ id: 23, quoteId: 13, reference: "K-7-V2", version: 2, status: "signed" }],
    );

    expect(context.workingQuote?.id).toBe(13);
    expect(context.workingContract?.quoteId).toBe(13);
  });
});
