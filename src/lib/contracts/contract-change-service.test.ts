import { describe, expect, it } from "vitest";
import { suggestContractChangeService } from "./contract-change-service";

describe("contract change service suggestion", () => {
  it("recognises a request to upgrade roof washing with impregnation", () => {
    expect(suggestContractChangeService("Jeg ønsker å endre avtalen fra Takvask til Takvask + impregnering.", "takvask"))
      .toBe("takvask_impregnering");
  });

  it("falls back to the current supported service when the comment is ambiguous", () => {
    expect(suggestContractChangeService("Jeg ønsker et annet tilbud.", "takmaling")).toBe("takmaling");
  });
});
