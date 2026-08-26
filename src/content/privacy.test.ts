import { describe, expect, it } from "vitest";
import { privacyAcknowledgement } from "./privacy";

describe("privacyAcknowledgement", () => {
  it("replaces the legacy mandatory consent with an acknowledgement", () => {
    expect(privacyAcknowledgement("no", "Jeg godtar at Takfornyelse lagrer opplysningene mine for å behandle henvendelsen.")).toContain("Jeg bekrefter");
    expect(privacyAcknowledgement("en", "I agree that Takfornyelse may store my details to process this enquiry.")).toContain("I confirm");
  });

  it("keeps a non-consent acknowledgement configured by an administrator", () => {
    expect(privacyAcknowledgement("no", "Jeg har lest personvernerklæringen.")).toBe("Jeg har lest personvernerklæringen.");
  });
});

