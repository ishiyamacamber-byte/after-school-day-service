import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeNewsletterImage, writeNewsletterImage } from "@/lib/newsletter-image-storage";

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function isPngFile(file: File): boolean {
  const byType = file.type === "image/png";
  const byName = file.name.toLowerCase().endsWith(".png");
  return byType || byName;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const facilityId = String(form.get("facilityId") ?? "").trim();
  const month = String(form.get("month") ?? "").trim();
  const file = form.get("file");

  if (!(file instanceof File) || !facilityId || !MONTH_RE.test(month)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isPngFile(file)) {
    return NextResponse.json({ error: "file_must_be_png" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } });
  if (!facility) {
    return NextResponse.json({ error: "facility_not_found" }, { status: 404 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const nextFilePath = await writeNewsletterImage(facilityId, month, bytes);

  try {
    const existing = await prisma.facilityMonthlyNewsletterImage.findUnique({
      where: { facilityId_month: { facilityId, month } },
      select: { id: true, filePath: true },
    });
    const saved = existing
      ? await prisma.facilityMonthlyNewsletterImage.update({
          where: { id: existing.id },
          data: {
            filePath: nextFilePath,
            uploadedById: session.user.id,
            uploadedAt: new Date(),
          },
        })
      : await prisma.facilityMonthlyNewsletterImage.create({
          data: {
            facilityId,
            month,
            filePath: nextFilePath,
            uploadedById: session.user.id,
          },
        });

    if (existing && existing.filePath !== nextFilePath) {
      await removeNewsletterImage(existing.filePath);
    }

    return NextResponse.json({
      ok: true,
      facilityId,
      month,
      uploadedAtIso: saved.uploadedAt.toISOString(),
      imageUrl: `/api/newsletters/image?facilityId=${encodeURIComponent(facilityId)}&month=${encodeURIComponent(month)}`,
    });
  } catch (e) {
    await removeNewsletterImage(nextFilePath);
    console.error(e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
