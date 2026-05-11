import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FACILITY_LIST_ORDER_BY } from "@/lib/facility-order";
import { formatDateYmdJapan } from "@/lib/datetime-japan";
import { SchedulesAdminClient } from "@/components/admin/schedules-admin-client";

export default async function AdminSchedulesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/apply");

  const openMonthConfig = await prisma.systemConfig.findUnique({ where: { key: "open_month" } });
  const initialMonth = openMonthConfig?.value ?? formatDateYmdJapan(new Date()).slice(0, 7);

  const [facilities, rows] = await Promise.all([
    prisma.facility.findMany({ select: { id: true, name: true }, orderBy: FACILITY_LIST_ORDER_BY }),
    prisma.facilityMonthlyScheduleImage.findMany({
      where: { month: initialMonth },
      select: { facilityId: true, uploadedAt: true, uploadedById: true },
    }),
  ]);
  const byFacility = new Map(rows.map((r) => [r.facilityId, r]));

  return (
    <SchedulesAdminClient
      initialMonth={initialMonth}
      initialRows={facilities.map((f) => {
        const current = byFacility.get(f.id);
        return {
          facilityId: f.id,
          facilityName: f.name,
          hasImage: !!current,
          uploadedAtIso: current?.uploadedAt.toISOString() ?? null,
          uploadedById: current?.uploadedById ?? null,
          imageUrl: current
            ? `/api/schedules/image?facilityId=${encodeURIComponent(f.id)}&month=${encodeURIComponent(initialMonth)}`
            : null,
        };
      })}
    />
  );
}

