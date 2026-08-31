import { describe, expect, it } from "vitest";
import { appendUniquePhotoFiles, type PhotoIdentity } from "./photo-selection";

function photo(
  name: string,
  size = 1_000,
  lastModified = 1,
  type = "image/jpeg",
): PhotoIdentity {
  return { name, size, lastModified, type };
}

describe("appendUniquePhotoFiles", () => {
  it("keeps the selected order when starting empty", () => {
    const selected = [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")];
    const result = appendUniquePhotoFiles([], selected, 15, 20_000);

    expect(result.files).toEqual(selected);
    expect(result.added).toEqual(selected);
  });

  it("adds later selections without replacing earlier files", () => {
    const existing = [photo("a.jpg"), photo("b.jpg")];
    const selected = [photo("c.jpg"), photo("d.jpg")];

    expect(
      appendUniquePhotoFiles(existing, selected, 15, 20_000).files,
    ).toEqual([...existing, ...selected]);
  });

  it("ignores duplicates across and within selections", () => {
    const a = photo("a.jpg");
    const b = photo("b.jpg");
    const c = photo("c.jpg");
    const result = appendUniquePhotoFiles([a, b], [b, c, c], 15, 20_000);

    expect(result.files).toEqual([a, b, c]);
    expect(result.duplicates).toBe(2);
  });

  it("treats same-name files with different metadata as distinct", () => {
    const first = photo("roof.jpg", 1_000, 1);
    const second = photo("roof.jpg", 2_000, 2);

    expect(appendUniquePhotoFiles([first], [second], 15, 20_000).files).toEqual(
      [first, second],
    );
  });

  it("filters oversized files before applying the total limit", () => {
    const existing = Array.from({ length: 14 }, (_, index) =>
      photo(`${index}.jpg`),
    );
    const oversized = photo("large.jpg", 30_000);
    const valid = photo("valid.jpg");
    const result = appendUniquePhotoFiles(
      existing,
      [oversized, valid],
      15,
      20_000,
    );

    expect(result.files).toHaveLength(15);
    expect(result.files.at(-1)).toBe(valid);
    expect(result.oversized).toBe(1);
    expect(result.ignoredByLimit).toBe(0);
  });

  it("keeps the first files that fit the limit", () => {
    const existing = Array.from({ length: 14 }, (_, index) =>
      photo(`${index}.jpg`),
    );
    const first = photo("first.jpg");
    const second = photo("second.jpg");
    const result = appendUniquePhotoFiles(
      existing,
      [first, second],
      15,
      20_000,
    );

    expect(result.files).toHaveLength(15);
    expect(result.files.at(-1)).toBe(first);
    expect(result.ignoredByLimit).toBe(1);
  });

  it("does not mutate either input", () => {
    const existing = [photo("a.jpg")];
    const selected = [photo("b.jpg")];
    const existingCopy = [...existing];
    const selectedCopy = [...selected];

    appendUniquePhotoFiles(existing, selected, 15, 20_000);

    expect(existing).toEqual(existingCopy);
    expect(selected).toEqual(selectedCopy);
  });
});
