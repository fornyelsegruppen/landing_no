const MAX_EDGE = 2200;
const MAX_UPLOAD_BYTES = 4_000_000;

export async function prepareWorkerPhoto(file: File): Promise<{ file: File; sha256: string }> {
  let prepared = file;
  if (!/heic|heif/i.test(file.type) && typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        let quality = 0.84;
        let blob: Blob | null = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
          if (!blob || blob.size <= MAX_UPLOAD_BYTES) break;
          quality -= 0.12;
        }
        if (blob) prepared = new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "tak"}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
      }
    } finally { bitmap.close(); }
  }
  if (prepared.size < 1 || prepared.size > 10_000_000) throw new Error("Use a photo up to 10 MB");
  const digest = await crypto.subtle.digest("SHA-256", await prepared.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { file: prepared, sha256 };
}
