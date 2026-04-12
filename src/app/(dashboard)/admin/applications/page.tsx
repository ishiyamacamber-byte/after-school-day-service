import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApplicationsAdminClient } from "@/components/admin/applications-admin-client";
import { countDaysByFacility, facilityCountsList } from "@/lib/admin-application-list";

function monthRange(month: string | undefined) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    month = `${yyyy}-${mm}`;
  }
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { month, start, end };
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; userId?: string; q?: string; sortFacility?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/apply");

  const sp = await searchParams;
  const { month, start, end } = monthRange(sp.month);
  const userId = sp.userId ?? "";
  const q = (sp.q ?? "").trim();
  const sortFacility = (sp.sortFacility ?? "").trim();

  const [users, rows, openMonthConfig, facilities] = await Promise.all([
    prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { loginId: "asc" },
      select: { id: true, name: true, loginId: true },
    }),
    prisma.application.findMany({
      where: {
        submittedAt: { gte: start, lt: end },
        ...(userId ? { userId } : {}),
      },
      orderBy: [{ submittedAt: "desc" }, { date: "asc" }],
      include: {
        user: { select: { name: true, loginId: true } },
        facility: { select: { name: true } },
      },
    }),
    prisma.systemConfig.findUnique({ where: { key: "open_month" } }),
    prisma.facility.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const byUser = new Map<
    string,
    {
      userId: string;
      userName: string;
      loginId: string;
      submittedAt: Date;
      submittedAtText: string;
      dayFacilities: Record<number, string[]>;
      overallNotes: string[];
      dailyNotes: string[];
      facilityCounts: Record<string, number>;
      facilityCountsList: { name: string; days: number }[];
      editableDayMap: Record<string, { date: string; facilityId: string; notes: string }>;
      overallNotesText: string;
    }
  >();

  for (const r of rows) {
    const key = r.userId;
    const current = byUser.get(key) ?? {
      userId: r.userId,
      userName: r.user.name,
      loginId: r.user.loginId,
      submittedAt: r.submittedAt,
      submittedAtText: format(r.submittedAt, "yyyy-MM-dd HH:mm"),
      dayFacilities: {},
      overallNotes: [],
      dailyNotes: [],
      facilityCounts: {} as Record<string, number>,
      facilityCountsList: [] as { name: string; days: number }[],
      editableDayMap: {} as Record<string, { date: string; facilityId: string; notes: string }>,
      overallNotesText: "",
    };
    if (r.submittedAt > current.submittedAt) {
      current.submittedAt = r.submittedAt;
      current.submittedAtText = format(r.submittedAt, "yyyy-MM-dd HH:mm");
    }
    if (r.date) {
      const day = r.date.getDate();
      const dateText = format(r.date, "yyyy-MM-dd");
      const name = r.facility?.name ?? "";
      if (name) {
        const list = current.dayFacilities[day] ?? [];
        if (!list.includes(name)) list.push(name);
        current.dayFacilities[day] = list;
      }
      current.editableDayMap[dateText] = {
        date: dateText,
        facilityId: r.facilityId ?? "",
        notes: r.notes?.trim() ?? "",
      };
      if (r.notes?.trim()) current.dailyNotes.push(`${day}日: ${r.notes.trim()}`);
    } else if (r.notes?.trim()) {
      current.overallNotes.push(r.notes.trim());
      current.overallNotesText = current.overallNotesText
        ? `${current.overallNotesText}\n${r.notes.trim()}`
        : r.notes.trim();
    }
    const fc = countDaysByFacility(current.dayFacilities);
    current.facilityCounts = fc;
    current.facilityCountsList = facilityCountsList(fc);
    byUser.set(key, current);
  }

  let groupedRows = [...byUser.values()].map(({ submittedAt: _submittedAt, editableDayMap, ...rest }) => ({
    ...rest,
    editableDays: Object.values(editableDayMap).sort((a, b) => a.date.localeCompare(b.date)),
  }));

  if (q) {
    const ql = q.toLowerCase();
    groupedRows = groupedRows.filter(
      (r) => r.userName.toLowerCase().includes(ql) || r.loginId.toLowerCase().includes(ql)
    );
  }

  if (sortFacility) {
    groupedRows = [...groupedRows].sort((a, b) => {
      const da = a.facilityCounts[sortFacility] ?? 0;
      const db = b.facilityCounts[sortFacility] ?? 0;
      if (db !== da) return db - da;
      return a.loginId.localeCompare(b.loginId);
    });
  } else {
    groupedRows = [...groupedRows].sort((a, b) => a.loginId.localeCompare(b.loginId));
  }

  return (
    <ApplicationsAdminClient
      month={month}
      userId={userId}
      q={q}
      sortFacility={sortFacility}
      openMonth={openMonthConfig?.value ?? month}
      users={users}
      facilities={facilities}
      rows={groupedRows}
    />
  );
}

