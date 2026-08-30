import { describe, expect, it } from "vitest";
import { workerDraftStatusLabel } from "./draft-status";

describe("worker draft status", () => {
  it("has no status before a real draft or send result exists", () => {
    expect(workerDraftStatusLabel(null, "lt")).toBeNull();
  });

  it("keeps explicit result labels after state changes", () => {
    expect(workerDraftStatusLabel("saved", "lt")).toBe(
      "Juodraštis saugomas šiame telefone",
    );
    expect(workerDraftStatusLabel("sent", "lt")).toBe("Išsiųsta");
    expect(workerDraftStatusLabel("error", "en")).toBe(
      "Error – data remains on this phone",
    );
  });
});
