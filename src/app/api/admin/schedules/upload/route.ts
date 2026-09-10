import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectUploadMedia, parseMediaSlot } from "@/lib/facility-media-file";
import { removeScheduleImage, writeScheduleImage } from "@/lib/schedule-image-storage";

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const facilityId = String(form.get("facilityId") ?? "").trim();
  const month = String(form.get("month") ?? "").trim();
  const slot = parseMediaSlot(form.get("slot") ?? "1") ?? 1;
  const file = form.get("file");

  if (!(file instanceof File) || !facilityId || !MONTH_RE.test(month)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const media = detectUploadMedia(file);
  if (!media) {
    return NextResponse.json({ error: "file_type_not_allowed" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } });
  if (!facility) {
    return NextResponse.json({ error: "facility_not_found" }, { status: 404 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const nextFilePath = await writeScheduleImage(facilityId, month, bytes, media.ext, slot);

  try {
    const existing = await prisma.facilityMonthlyScheduleImage.findUnique({
      where: { facilityId_month_slot: { facilityId, month, slot } },
      select: { id: true, filePath: true },
    });
    const saved = existing
      ? await prisma.facilityMonthlyScheduleImage.update({
          where: { id: existing.id },
          data: {
            filePath: nextFilePath,
            uploadedById: session.user.id,
            uploadedAt: new Date(),
          },
        })
      : await prisma.facilityMonthlyScheduleImage.create({
          data: {
            facilityId,
            month,
            slot,
            filePath: nextFilePath,
            uploadedById: session.user.id,
          },
        });

    if (existing && existing.filePath !== nextFilePath) {
      await removeScheduleImage(existing.filePath);
    }

    return NextResponse.json({
      ok: true,
      facilityId,
      month,
      slot,
      uploadedAtIso: saved.uploadedAt.toISOString(),
      mediaKind: media.ext === "pdf" ? "pdf" : "image",
      imageUrl: `/api/schedules/image?facilityId=${encodeURIComponent(facilityId)}&month=${encodeURIComponent(month)}&slot=${slot}`,
    });
  } catch (e) {
    await removeScheduleImage(nextFilePath);
    console.error(e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
