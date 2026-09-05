import { describe, expect, it } from "vitest";
import { leadAdminRecipients } from "./lead-admin-recipients";

describe("lead admin recipients", () => {
  it("returns one normalized primary recipient", () => {
    expect(
      leadAdminRecipients({ primary: " Post@Takfornyelsenorge.no " }),
    ).toEqual(["post@takfornyelsenorge.no"]);
  });

  it("returns one deduplicated Resend recipient array with the old safety copy", () => {
    expect(
      leadAdminRecipients({
        primary: "post@takfornyelsenorge.no",
        copy: " POST@TAKFORNYELSE.AS ",
      }),
    ).toEqual(["post@takfornyelsenorge.no", "post@takfornyelse.as"]);
  });

  it("deduplicates equal primary and copy recipients", () => {
    expect(
      leadAdminRecipients({
        primary: "post@takfornyelsenorge.no",
        copy: "POST@TAKFORNYELSENORGE.NO",
      }),
    ).toEqual(["post@takfornyelsenorge.no"]);
  });

  it.each([
    "",
    "not-an-email",
    "one@example.no,two@example.no",
    "Name <one@example.no>",
  ])("rejects invalid single-address configuration %j", (primary) => {
    expect(() => leadAdminRecipients({ primary })).toThrow(
      /LEAD_TO_EMAIL must contain one valid email address/,
    );
  });

  it("rejects a comma list in the dedicated copy variable", () => {
    expect(() =>
      leadAdminRecipients({
        primary: "post@takfornyelsenorge.no",
        copy: "one@example.no,two@example.no",
      }),
    ).toThrow(/LEAD_ADMIN_COPY_EMAIL must contain one valid email address/);
  });
});
