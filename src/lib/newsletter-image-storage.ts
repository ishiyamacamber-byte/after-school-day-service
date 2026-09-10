import path from "node:path";
import { promises as fs } from "node:fs";
import type { MediaExt, MediaSlot } from "@/lib/facility-media-file";
import { buildFacilityMediaFileName, isAllowedMediaExt } from "@/lib/facility-media-file";

const MONTH_RE = /^\d{4}-\d{2}$/;
const FACILITY_ID_RE = /^[a-zA-Z0-9_-]+$/;
const SIBLING_EXTS: MediaExt[] = ["png", "jpg", "pdf"];

export function isValidMonthKey(month: string): boolean {
  return MONTH_RE.test(month);
}

function assertValidMonthKey(month: string): void {
  if (!isValidMonthKey(month)) {
    throw new Error("invalid_month");
  }
}

function assertValidFacilityId(facilityId: string): void {
  if (!FACILITY_ID_RE.test(facilityId)) {
    throw new Error("invalid_facility_id");
  }
}

export function getNewsletterImageRootDir(): string {
  const configured = process.env.NEWSLETTER_IMAGE_DIR?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "data", "newsletters");
}

export function buildNewsletterImageRelativePath(
  facilityId: string,
  month: string,
  ext: MediaExt = "png",
  slot: MediaSlot = 1
): string {
  assertValidFacilityId(facilityId);
  assertValidMonthKey(month);
  if (!isAllowedMediaExt(ext)) {
    throw new Error("invalid_ext");
  }
  return path.posix.join(month, buildFacilityMediaFileName(facilityId, slot, ext));
}

function resolveSafeAbsolutePath(relativePath: string): string {
  const root = getNewsletterImageRootDir();
  const absolute = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root);
  if (!absolute.startsWith(normalizedRoot)) {
    throw new Error("invalid_file_path");
  }
  return absolute;
}

export async function writeNewsletterImage(
  facilityId: string,
  month: string,
  bytes: Uint8Array,
  ext: MediaExt,
  slot: MediaSlot = 1
): Promise<string> {
  const relativePath = buildNewsletterImageRelativePath(facilityId, month, ext, slot);
  const absolutePath = resolveSafeAbsolutePath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);

  await Promise.all(
    SIBLING_EXTS.filter((e) => e !== ext).map(async (e) => {
      const sibling = buildNewsletterImageRelativePath(facilityId, month, e, slot);
      await removeNewsletterImage(sibling);
    })
  );

  return relativePath;
}

export async function readNewsletterImage(relativePath: string): Promise<Buffer> {
  const absolutePath = resolveSafeAbsolutePath(relativePath);
  return fs.readFile(absolutePath);
}

export async function removeNewsletterImage(relativePath: string): Promise<void> {
  const absolutePath = resolveSafeAbsolutePath(relativePath);
  await fs.unlink(absolutePath).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return;
    throw e;
  });
}
