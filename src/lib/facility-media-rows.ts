import type { MediaKind, MediaSlot } from "@/lib/facility-media-file";
import { mediaKindFromRelativePath } from "@/lib/facility-media-file";

export type FacilityMediaFileDto = {
  slot: MediaSlot;
  mediaKind: MediaKind;
  imageUrl: string;
  uploadedAtIso: string;
};

type MediaRow = {
  facilityId: string;
  slot: number;
  filePath: string;
  uploadedAt: Date;
  uploadedById?: string;
};

export function buildFacilityMediaFiles(
  rows: MediaRow[],
  month: string,
  imagePathPrefix: "/api/schedules/image" | "/api/newsletters/image"
): FacilityMediaFileDto[] {
  return rows
    .filter((r): r is MediaRow & { slot: MediaSlot } => r.slot === 1 || r.slot === 2)
    .sort((a, b) => a.slot - b.slot)
    .map((r) => ({
      slot: r.slot,
      mediaKind: mediaKindFromRelativePath(r.filePath),
      uploadedAtIso: r.uploadedAt.toISOString(),
      imageUrl: `${imagePathPrefix}?facilityId=${encodeURIComponent(r.facilityId)}&month=${encodeURIComponent(month)}&slot=${r.slot}`,
    }));
}

export function groupMediaRowsByFacility<T extends MediaRow>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.facilityId) ?? [];
    list.push(row);
    map.set(row.facilityId, list);
  }
  return map;
}
