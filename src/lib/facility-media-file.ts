export type MediaExt = "png" | "jpg" | "pdf";
export type MediaKind = "image" | "pdf";
export type MediaSlot = 1 | 2;

const ALLOWED_EXTS = new Set<MediaExt>(["png", "jpg", "pdf"]);

export function parseMediaSlot(raw: unknown): MediaSlot | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (n === 1 || n === 2) return n;
  return null;
}

export function detectUploadMedia(file: { name?: string; type?: string }): {
  ext: MediaExt;
  contentType: string;
} | null {
  const name = String(file.name ?? "").toLowerCase();
  const type = String(file.type ?? "").toLowerCase();

  if (type === "image/png" || name.endsWith(".png")) {
    return { ext: "png", contentType: "image/png" };
  }
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/pjpeg" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".jfif")
  ) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (type === "application/pdf" || type === "application/x-pdf" || name.endsWith(".pdf")) {
    return { ext: "pdf", contentType: "application/pdf" };
  }
  return null;
}

/** MIME/拡張子が取れない場合用（先頭バイトで判定） */
export function detectMediaByMagicBytes(bytes: Uint8Array): { ext: MediaExt; contentType: string } | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  // %PDF
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { ext: "pdf", contentType: "application/pdf" };
  }
  return null;
}

export function resolveUploadMedia(
  file: { name?: string; type?: string },
  bytes: Uint8Array
): { ext: MediaExt; contentType: string } | null {
  return detectUploadMedia(file) ?? detectMediaByMagicBytes(bytes);
}

export function isAllowedMediaExt(ext: string): ext is MediaExt {
  return ALLOWED_EXTS.has(ext as MediaExt);
}

export function contentTypeFromRelativePath(relativePath: string): string {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

export function mediaKindFromRelativePath(relativePath: string): MediaKind {
  return relativePath.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
}

export function mediaKindFromContentType(contentType: string): MediaKind {
  return contentType === "application/pdf" ? "pdf" : "image";
}

/** slot1 は後方互換で facilityId.ext、slot2 は facilityId-2.ext */
export function buildFacilityMediaFileName(facilityId: string, slot: MediaSlot, ext: MediaExt): string {
  if (slot === 1) return `${facilityId}.${ext}`;
  return `${facilityId}-2.${ext}`;
}
