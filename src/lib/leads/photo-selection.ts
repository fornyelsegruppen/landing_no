export type PhotoIdentity = Pick<
  File,
  "name" | "size" | "lastModified" | "type"
>;

function photoFingerprint(file: PhotoIdentity) {
  return [file.name, file.size, file.lastModified, file.type].join("\0");
}

export function appendUniquePhotoFiles<T extends PhotoIdentity>(
  existing: readonly T[],
  selected: readonly T[],
  maxFiles: number,
  maxBytes: number,
) {
  const seen = new Set(existing.map(photoFingerprint));
  const accepted: T[] = [];
  let duplicates = 0;
  let oversized = 0;
  let ignoredByLimit = 0;

  for (const file of selected) {
    if (file.size > maxBytes) {
      oversized += 1;
      continue;
    }

    const fingerprint = photoFingerprint(file);
    if (seen.has(fingerprint)) {
      duplicates += 1;
      continue;
    }
    seen.add(fingerprint);

    if (existing.length + accepted.length >= maxFiles) {
      ignoredByLimit += 1;
      continue;
    }

    accepted.push(file);
  }

  return {
    files: [...existing, ...accepted],
    added: accepted,
    duplicates,
    oversized,
    ignoredByLimit,
  };
}
