import path from "node:path";
import { promises as fs } from "node:fs";

const MONTH_RE = /^\d{4}-\d{2}$/;
const FACILITY_ID_RE = /^[a-zA-Z0-9_-]+$/;

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

export function getScheduleImageRootDir(): string {
  const configured = process.env.SCHEDULE_IMAGE_DIR?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "data", "schedules");
}

export function buildScheduleImageRelativePath(facilityId: string, month: string): string {
  assertValidFacilityId(facilityId);
  assertValidMonthKey(month);
  return path.posix.join(month, `${facilityId}.png`);
}

function resolveSafeAbsolutePath(relativePath: string): string {
  const root = getScheduleImageRootDir();
  const absolute = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root);
  if (!absolute.startsWith(normalizedRoot)) {
    throw new Error("invalid_file_path");
  }
  return absolute;
}

export async function writeScheduleImage(
  facilityId: string,
  month: string,
  pngBytes: Uint8Array
): Promise<string> {
  const relativePath = buildScheduleImageRelativePath(facilityId, month);
  const absolutePath = resolveSafeAbsolutePath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, pngBytes);
  return relativePath;
}

export async function readScheduleImage(relativePath: string): Promise<Buffer> {
  const absolutePath = resolveSafeAbsolutePath(relativePath);
  return fs.readFile(absolutePath);
}

export async function removeScheduleImage(relativePath: string): Promise<void> {
  const absolutePath = resolveSafeAbsolutePath(relativePath);
  await fs.unlink(absolutePath).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return;
    throw e;
  });
}

