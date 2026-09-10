export type MediaExt = "png" | "jpg" | "pdf";
export type MediaKind = "image" | "pdf";

const ALLOWED_EXTS = new Set<MediaExt>(["png", "jpg", "pdf"]);

export function detectUploadMedia(file: File): { ext: MediaExt; contentType: string } | null {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (type === "image/png" || name.endsWith(".png")) {
    return { ext: "png", contentType: "image/png" };
  }
  if (type === "image/jpeg" || type === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return { ext: "pdf", contentType: "application/pdf" };
  }
  return null;
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
