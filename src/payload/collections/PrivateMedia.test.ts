import { describe, expect, it } from "vitest";
import { PrivateMedia } from "./PrivateMedia";

describe("PrivateMedia collection", () => {
  it("keeps the collection out of the generic admin and blocks direct mutations", async () => {
    expect(PrivateMedia.admin?.hidden).toBe(true);

    for (const operation of ["create", "update", "delete"] as const) {
      const access = PrivateMedia.access?.[operation];
      expect(typeof access).toBe("function");
      if (typeof access === "function") {
        await expect(
          Promise.resolve(access({ req: { user: { role: "admin" } } } as never)),
        ).resolves.toBe(false);
      }
    }
  });
});
