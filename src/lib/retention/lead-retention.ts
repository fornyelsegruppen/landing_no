import { parseLeadPhotoUrls } from "@/lib/lead-photo-token";

export function privateLeadBlobUrls(value: unknown) {
  const urls = new Set<string>();
  for (const raw of parseLeadPhotoUrls(value)) {
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com")) urls.add(`${url.origin}${url.pathname}`);
    } catch { /* Ignore malformed legacy values. */ }
  }
  return [...urls];
}

export function retainedBySignedContract(error: unknown) {
  return /signed contract must be archived/i.test(error instanceof Error ? error.message : "");
}
