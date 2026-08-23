import { describe, expect, it } from "vitest";
import {
  makeAnonymousJobFixture,
  makeAnonymousLeadFixture,
} from "./platform-fixtures";

describe("anonymous platform fixtures", () => {
  it("uses reserved synthetic contact details", () => {
    const lead = makeAnonymousLeadFixture();

    expect(lead.email).toMatch(/@example\.invalid$/);
    expect(lead.name).toBe("Testkunde");
  });

  it("allows focused overrides without customer data", () => {
    expect(makeAnonymousJobFixture({ status: "retry" })).toMatchObject({
      status: "retry",
      payload: { entityId: "synthetic-entity" },
    });
  });
});
