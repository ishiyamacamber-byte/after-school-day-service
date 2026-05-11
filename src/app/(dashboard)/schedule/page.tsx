import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FACILITY_LIST_ORDER_BY } from "@/lib/facility-order";
import { formatDateYmdJapan } from "@/lib/datetime-japan";
import { ScheduleGalleryClient } from "@/components/schedule/schedule-gallery-client";

function parseAllowedFacilityIds(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function monthLabelJa(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sp = await searchParams;
  const openMonthConfig = await prisma.systemConfig.findUnique({ where: { key: "open_month" } });
  const fallbackMonth = openMonthConfig?.value ?? formatDateYmdJapan(new Date()).slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? (sp.month as string) : fallbackMonth;
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, allowedFacilityIds: true },
  });
  if (!currentUser) redirect("/login");
  const allowedIds = parseAllowedFacilityIds(currentUser.allowedFacilityIds);
  const visibleFacilityWhere =
    currentUser.role === "ADMIN" || allowedIds.length === 0 ? {} : { id: { in: allowedIds } };

  const [facilities, rows] = await Promise.all([
    prisma.facility.findMany({
      where: visibleFacilityWhere,
      select: { id: true, name: true },
      orderBy: FACILITY_LIST_ORDER_BY,
    }),
    prisma.facilityMonthlyScheduleImage.findMany({
      where: { month },
      select: { facilityId: true, uploadedAt: true },
    }),
  ]);
  const byFacility = new Map(rows.map((r) => [r.facilityId, r]));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-lg font-bold text-slate-900">事業所別予定表</h1>
        <p className="mt-1 text-xs text-slate-600">月を選ぶと、事業所ごとの予定表（PNG）を確認できます。</p>
        <form method="GET" className="mt-3 flex items-center gap-2">
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            表示
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-600">表示中: {monthLabelJa(month)}（{month}）</p>
      </div>

      <ScheduleGalleryClient
        month={month}
        rows={facilities.map((f) => {
          const row = byFacility.get(f.id);
          return {
            facilityId: f.id,
            facilityName: f.name,
            uploadedAtIso: row?.uploadedAt.toISOString() ?? null,
            imageUrl: row
              ? `/api/schedules/image?facilityId=${encodeURIComponent(f.id)}&month=${encodeURIComponent(month)}`
              : null,
          };
        })}
      />
    </div>
  );
}

