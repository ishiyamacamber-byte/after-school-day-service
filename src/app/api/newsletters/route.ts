import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FACILITY_LIST_ORDER_BY } from "@/lib/facility-order";
import { formatDateYmdJapan } from "@/lib/datetime-japan";

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const monthRaw = (url.searchParams.get("month") ?? "").trim();
  const month = MONTH_RE.test(monthRaw) ? monthRaw : formatDateYmdJapan(new Date()).slice(0, 7);

  const [facilities, rows] = await Promise.all([
    prisma.facility.findMany({ select: { id: true, name: true }, orderBy: FACILITY_LIST_ORDER_BY }),
    prisma.facilityMonthlyNewsletterImage.findMany({
      where: { month },
      select: { facilityId: true, uploadedAt: true },
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
        imageUrl: current
          ? `/api/newsletters/image?facilityId=${encodeURIComponent(f.id)}&month=${encodeURIComponent(month)}`
          : null,
      };
    }),
  });
}
