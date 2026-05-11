import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { formatDateTimeJapan, formatDateYmdJapan } from "@/lib/datetime-japan";
import { prisma } from "@/lib/prisma";
import { ApplicationsAdminClient } from "@/components/admin/applications-admin-client";
import { countDaysByFacility, facilityCountsList } from "@/lib/admin-application-list";
import { FACILITY_LIST_ORDER_BY } from "@/lib/facility-order";

function parseAllowedIds(raw: string | null | undefined): string[] {
  try {
    const list = JSON.parse(raw ?? "[]") as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** allowedFacilityIds が空なら制限なし（どの事業所も利用可能）と submit ルートと揃える */
function userMayUseFacility(allowedFacilityIdsRaw: string | null | undefined, facilityId: string): boolean {
  const ids = parseAllowedIds(allowedFacilityIdsRaw);
  if (ids.length === 0) return true;
  return ids.includes(facilityId);
}

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
  searchParams: Promise<{
    month?: string;
    userId?: string;
    q?: string;
    sortFacility?: string;
    /** submitted=申請日時順（早い申請が上） / management=管理番号順 */
    listSort?: string;
    unsubmittedFirst?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/apply");

  const sp = await searchParams;
  const { month, start, end } = monthRange(sp.month);
  const userId = sp.userId ?? "";
  const q = (sp.q ?? "").trim();
  /** 事業所 ID（利用者設定の allowedFacilityIds と突き合わせる） */
  const sortFacility = (sp.sortFacility ?? "").trim();
  const listSort = sp.listSort === "management" ? "management" : "submitted";
  const unsubmittedFirst = sp.unsubmittedFirst === "1";

  const [users, datedRows, openMonthConfig, facilities] = await Promise.all([
    prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { loginId: "asc" },
      select: {
        id: true,
        name: true,
        loginId: true,
        allowedFacilityIds: true,
        managementNumber: true,
        monthlyLimit: true,
      },
    }),
    prisma.application.findMany({
      where: {
        date: { gte: start, lt: end },
        ...(userId ? { userId } : {}),
      },
      orderBy: [{ submittedAt: "desc" }, { date: "asc" }],
      include: {
        user: { select: { name: true, loginId: true } },
        facility: { select: { name: true } },
      },
    }),
    prisma.systemConfig.findUnique({ where: { key: "open_month" } }),
    prisma.facility.findMany({ orderBy: FACILITY_LIST_ORDER_BY, select: { id: true, name: true } }),
  ]);

  const targetGroupIds = [...new Set(datedRows.map((r) => r.groupId))];
  const overallRows =
    targetGroupIds.length > 0
      ? await prisma.application.findMany({
          where: {
            groupId: { in: targetGroupIds },
            date: null,
            ...(userId ? { userId } : {}),
          },
          orderBy: [{ submittedAt: "desc" }],
          include: {
            user: { select: { name: true, loginId: true } },
            facility: { select: { name: true } },
          },
        })
      : [];
  const rows = [...datedRows, ...overallRows];

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
      submittedAtText: formatDateTimeJapan(r.submittedAt),
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
      current.submittedAtText = formatDateTimeJapan(r.submittedAt);
    }
    if (r.date) {
      const dateText = formatDateYmdJapan(r.date);
      const day = Number(dateText.slice(8, 10));
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

  let groupedRows = users.map((u) => {
    const existing = byUser.get(u.id);
    if (existing) {
      const { editableDayMap, ...rest } = existing;
      const appliedDaysCount = Object.keys(editableDayMap).length;
      return {
        ...rest,
        hasSubmission: true as const,
        managementNumber: u.managementNumber,
        monthlyLimit: u.monthlyLimit,
        appliedDaysCount,
        editableDays: Object.values(editableDayMap).sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
    return {
      userId: u.id,
      userName: u.name,
      loginId: u.loginId,
      submittedAtText: "未申請",
      submittedAt: null as Date | null,
      dayFacilities: {} as Record<number, string[]>,
      overallNotes: [] as string[],
      dailyNotes: [] as string[],
      facilityCounts: {} as Record<string, number>,
      facilityCountsList: [] as { name: string; days: number }[],
      editableDays: [] as { date: string; facilityId: string; notes: string }[],
      overallNotesText: "",
      hasSubmission: false as const,
      managementNumber: u.managementNumber,
      monthlyLimit: u.monthlyLimit,
      appliedDaysCount: 0,
    };
  });

  if (q) {
    const ql = q.toLowerCase();
    groupedRows = groupedRows.filter(
      (r) => r.userName.toLowerCase().includes(ql) || r.loginId.toLowerCase().includes(ql)
    );
  }

  function cmpManagementNumber(a: number | null, b: number | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  }

  const allowedFirst = sortFacility.length
    ? new Map(users.map((u) => [u.id, userMayUseFacility(u.allowedFacilityIds, sortFacility)]))
    : null;

  groupedRows = [...groupedRows].sort((a, b) => {
    if (unsubmittedFirst && a.hasSubmission !== b.hasSubmission) {
      return a.hasSubmission ? 1 : -1;
    }
    if (allowedFirst) {
      const aOk = allowedFirst.get(a.userId) ?? false;
      const bOk = allowedFirst.get(b.userId) ?? false;
      if (aOk !== bOk) return aOk ? -1 : 1;
    }
    if (listSort === "management") {
      const c = cmpManagementNumber(a.managementNumber, b.managementNumber);
      if (c !== 0) return c;
      return a.loginId.localeCompare(b.loginId);
    }
    if (a.hasSubmission && b.hasSubmission) {
      const c = a.submittedAt.getTime() - b.submittedAt.getTime();
      if (c !== 0) return c;
      return a.loginId.localeCompare(b.loginId);
    }
    if (a.hasSubmission !== b.hasSubmission) {
      return a.hasSubmission ? -1 : 1;
    }
    const c = cmpManagementNumber(a.managementNumber, b.managementNumber);
    if (c !== 0) return c;
    return a.loginId.localeCompare(b.loginId);
  });

  const rowsForClient = groupedRows.map(({ submittedAt: _submittedAt, managementNumber: _mn, ...row }) => row);

  return (
    <ApplicationsAdminClient
      month={month}
      userId={userId}
      q={q}
      sortFacility={sortFacility}
      listSort={listSort}
      unsubmittedFirst={unsubmittedFirst}
      openMonth={openMonthConfig?.value ?? month}
      users={users.map(({ id, name, loginId }) => ({ id, name, loginId }))}
      facilities={facilities}
      rows={rowsForClient}
    />
  );
}

