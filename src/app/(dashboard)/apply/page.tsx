import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { formatDateTimeJapan, formatDateYmdJapan } from "@/lib/datetime-japan";
import { prisma } from "@/lib/prisma";
import { ApplyPageClient } from "@/components/apply/apply-page-client";
import { queryAdminEditLogsForTargetMonth } from "@/lib/application-admin-edit-log";
import { FACILITY_LIST_ORDER_BY } from "@/lib/facility-order";

type SnapshotPayload = {
  days?: { date: string; facilityId: string; notes?: string }[];
  overallNotes?: string;
};

type UserAdminEditHistoryItem = {
  id: string;
  editedAtText: string;
  editorName: string;
  editorLoginId: string;
  overallNotes: string | null;
  dayRows: { date: string; facilityName: string; notes: string }[];
};

function buildUserAdminEditHistory(
  logs: {
    id: string;
    editedAt: Date;
    editorName: string;
    editorLoginId: string;
    snapshotJson: string;
  }[],
  facilityNameById: Map<string, string>
): UserAdminEditHistoryItem[] {
  return logs.map((log) => {
    let overallNotes: string | null = null;
    let dayRows: { date: string; facilityName: string; notes: string }[] = [];
    try {
      const s = JSON.parse(log.snapshotJson) as SnapshotPayload;
      overallNotes = s.overallNotes?.trim() ? s.overallNotes.trim() : null;
      dayRows = (s.days ?? []).map((d) => ({
        date: d.date,
        facilityName: facilityNameById.get(d.facilityId) ?? d.facilityId,
        notes: d.notes?.trim() ?? "",
      }));
      dayRows.sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      // ignore parse errors
    }
    return {
      id: log.id,
      editedAtText: formatDateTimeJapan(log.editedAt),
      editorName: log.editorName,
      editorLoginId: log.editorLoginId,
      overallNotes,
      dayRows,
    };
  });
}

export default async function ApplyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [user, facilities, openMonthConfig] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, defaultSchedule: true, allowedFacilityIds: true, monthlyLimit: true },
    }),
    prisma.facility.findMany({ orderBy: FACILITY_LIST_ORDER_BY }),
    prisma.systemConfig.findUnique({ where: { key: "open_month" } }),
  ]);

  if (!user) redirect("/login");

  const openMonth = openMonthConfig?.value ?? formatDateYmdJapan(new Date()).slice(0, 7);
  const dayApps = await prisma.application.findMany({
    where: { userId: user.id, date: { not: null } },
    orderBy: [{ date: "asc" }],
    include: { facility: { select: { name: true } } },
  });

  const monthsSet = new Set<string>();
  const groupIds = new Set<string>();
  const summariesByMonth: Record<
    string,
    { days: Record<string, { facilityName: string; notes: string | null }>; overallNotes: string | null }
  > = {};

  for (const a of dayApps) {
    if (!a.date) continue;
    const mk = formatDateYmdJapan(a.date).slice(0, 7);
    monthsSet.add(mk);
    groupIds.add(a.groupId);
    const key = formatDateYmdJapan(a.date);
    const s =
      summariesByMonth[mk] ??
      ({
        days: {},
        overallNotes: null,
      } as {
        days: Record<string, { facilityName: string; notes: string | null }>;
        overallNotes: string | null;
      });
    s.days[key] = {
      facilityName: a.facility?.name ?? "",
      notes: a.notes?.trim() ?? null,
    };
    summariesByMonth[mk] = s;
  }

  const overallApps =
    groupIds.size > 0
      ? await prisma.application.findMany({
          where: { userId: user.id, groupId: { in: [...groupIds] }, date: null },
          orderBy: [{ submittedAt: "desc" }],
        })
      : [];
  for (const a of overallApps) {
    const anyDay = dayApps.find((d) => d.groupId === a.groupId && d.date);
    if (!anyDay?.date) continue;
    const mk = formatDateYmdJapan(anyDay.date).slice(0, 7);
    if (!summariesByMonth[mk]) continue;
    const nowOverall = summariesByMonth[mk]!.overallNotes;
    const note = a.notes?.trim();
    if (!note) continue;
    summariesByMonth[mk]!.overallNotes = nowOverall ? `${nowOverall} / ${note}` : note;
  }

  const submittedMonths = [...monthsSet].sort();
  const hasOpenMonthSubmission = submittedMonths.includes(openMonth);
  const openMonthSummary = summariesByMonth[openMonth] ?? null;
  const latestAppRow = await prisma.application.findFirst({
    where: { userId: user.id },
    orderBy: { submittedAt: "desc" },
    select: { submittedAt: true },
  });
  const latestSubmittedAt = latestAppRow?.submittedAt ?? null;

  const facilityNameById = new Map(
    (await prisma.facility.findMany({ orderBy: FACILITY_LIST_ORDER_BY, select: { id: true, name: true } })).map(
      (f) => [f.id, f.name]
    )
  );

  const adminEditLogs = await queryAdminEditLogsForTargetMonth(prisma, user.id, openMonth);
  const adminEditHistory = buildUserAdminEditHistory(adminEditLogs, facilityNameById);

  const allowed = (() => {
    try {
      return JSON.parse(user.allowedFacilityIds) as string[];
    } catch {
      return [] as string[];
    }
  })();
  const filteredFacilities =
    allowed.length > 0 ? facilities.filter((f) => allowed.includes(f.id)) : facilities;

  return (
    <ApplyPageClient
      user={{
        id: user.id,
        defaultSchedule: user.defaultSchedule,
        monthlyLimit: user.monthlyLimit,
        openMonth,
        alreadySubmitted: hasOpenMonthSubmission,
        submittedAtText: latestSubmittedAt ? formatDateTimeJapan(latestSubmittedAt) : null,
        submissionSummary: openMonthSummary,
        summariesByMonth,
        submittedMonths,
        adminEditHistory,
      }}
      facilities={filteredFacilities}
    />
  );
}
