import { describe, expect, it } from "vitest";
import { parseCanonicalWorkQueueQuery } from "./work-queue-contract";
import { createAdminNextWorkQueueFixture } from "./work-queue-fixture";

describe("Admin Next Work Queue fixture", () => {
  it("carries its declared synthetic customer identity into the queue contract", () => {
    const parsed = parseCanonicalWorkQueueQuery(
      "view=today&queue=all&limit=25",
    );
    if (!parsed.ok) throw new Error(parsed.code);

    const page = createAdminNextWorkQueueFixture("lt", parsed.value);
    const item = page.items.find(({ case: value }) => value.id === "case:1042");

    expect(item?.case).toMatchObject({
      customerName: "Kari Nilsen",
      postalAddress: "Testveien 12, Oslo",
    });
  });
});
