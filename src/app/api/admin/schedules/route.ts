import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeScheduleImage } from "@/lib/schedule-image-storage";
import { FACILITY_LIST_ORDER_BY } from "@/lib/facility-order";
import { parseMediaSlot } from "@/lib/facility-media-file";
import { buildFacilityMediaFiles, groupMediaRowsByFacility } from "@/lib/facility-media-rows";

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
    prisma.facilityMonthlyScheduleImage.findMany({
      where: { month },
      select: { facilityId: true, slot: true, uploadedAt: true, uploadedById: true, filePath: true },
      orderBy: [{ facilityId: "asc" }, { slot: "asc" }],
    }),
  ]);
  const byFacility = groupMediaRowsByFacility(rows);

  return NextResponse.json({
    month,
    rows: facilities.map((f) => {
      const files = buildFacilityMediaFiles(byFacility.get(f.id) ?? [], month, "/api/schedules/image");
      return {
        facilityId: f.id,
        facilityName: f.name,
        files,
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
      slot: z.union([z.literal(1), z.literal(2)]).optional(),
    })
    .safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { facilityId, month } = parsed.data;
  const slot = parseMediaSlot(parsed.data.slot ?? 1) ?? 1;

  const existing = await prisma.facilityMonthlyScheduleImage.findUnique({
    where: { facilityId_month_slot: { facilityId, month, slot } },
    select: { id: true, filePath: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: true, deleted: false });
  }

  await prisma.facilityMonthlyScheduleImage.delete({ where: { id: existing.id } });
  await removeScheduleImage(existing.filePath);

  return NextResponse.json({ ok: true, deleted: true, slot });
}
