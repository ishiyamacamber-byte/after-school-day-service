import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeNewsletterImage } from "@/lib/newsletter-image-storage";
import { FACILITY_LIST_ORDER_BY } from "@/lib/facility-order";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { error: null };
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const url = new URL(req.url);
  const parsed = monthSchema.safeParse(url.searchParams.get("month") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }
  const month = parsed.data;

  const [facilities, rows] = await Promise.all([
    prisma.facility.findMany({ select: { id: true, name: true }, orderBy: FACILITY_LIST_ORDER_BY }),
    prisma.facilityMonthlyNewsletterImage.findMany({
      where: { month },
      select: { facilityId: true, uploadedAt: true, uploadedById: true },
    }),
  ]);
  const byFacility = new Map(rows.map((r) => [r.facilityId, r]));

  return NextResponse.json({
    month,
    rows: facilities.map((f) => {
      const current = byFacility.get(f.id);
      return {
        facilityId: f.id,
        facilityName: f.name,
        hasImage: !!current,
        uploadedAtIso: current?.uploadedAt.toISOString() ?? null,
        uploadedById: current?.uploadedById ?? null,
        imageUrl: current
          ? `/api/newsletters/image?facilityId=${encodeURIComponent(f.id)}&month=${encodeURIComponent(month)}`
          : null,
      };
    }),
  });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const json = await req.json().catch(() => null);
  const parsed = z
    .object({
      facilityId: z.string().min(1),
      month: monthSchema,
    })
    .safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { facilityId, month } = parsed.data;

  const existing = await prisma.facilityMonthlyNewsletterImage.findUnique({
    where: { facilityId_month: { facilityId, month } },
    select: { id: true, filePath: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: true, deleted: false });
  }

  await prisma.facilityMonthlyNewsletterImage.delete({ where: { id: existing.id } });
  await removeNewsletterImage(existing.filePath);

  return NextResponse.json({ ok: true, deleted: true });
}
