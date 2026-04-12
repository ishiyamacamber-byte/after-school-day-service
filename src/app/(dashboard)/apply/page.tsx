import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApplyPageClient } from "@/components/apply/apply-page-client";
import { queryAdminEditLogsForTargetMonth } from "@/lib/application-admin-edit-log";
import { monthEndExclusive, monthStart, toMonthKey } from "@/lib/month";

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
      editedAtText: format(log.editedAt, "yyyy-MM-dd HH:mm"),
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
    prisma.facility.findMany({ orderBy: { name: "asc" } }),
    prisma.systemConfig.findUnique({ where: { key: "open_month" } }),
  ]);

  if (!user) redirect("/login");

  const openMonth = openMonthConfig?.value ?? toMonthKey(new Date());
  const [start, end] = [monthStart(openMonth), monthEndExclusive(openMonth)];
  const latestSubmission = await prisma.application.findFirst({
    where: { userId: user.id, submittedAt: { gte: start, lt: end } },
    orderBy: { submittedAt: "desc" },
    select: { submittedAt: true },
  });

  let submissionSummary: {
    days: Record<string, { facilityName: string; notes: string | null }>;
    overallNotes: string | null;
  } | null = null;

  if (latestSubmission) {
    const apps = await prisma.application.findMany({
      where: { userId: user.id, submittedAt: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }],
      include: { facility: { select: { name: true } } },
    });
    const days: Record<string, { facilityName: string; notes: string | null }> = {};
    const overallParts: string[] = [];
    for (const a of apps) {
      if (!a.date) {
        if (a.notes?.trim()) overallParts.push(a.notes.trim());
        continue;
      }
      const key = format(a.date, "yyyy-MM-dd");
      days[key] = {
        facilityName: a.facility?.name ?? "",
        notes: a.notes?.trim() ?? null,
      };
    }
    submissionSummary = {
      days,
      overallNotes: overallParts.length > 0 ? overallParts.join(" / ") : null,
    };
  }

  const facilityNameById = new Map(
    (await prisma.facility.findMany({ select: { id: true, name: true } })).map((f) => [f.id, f.name])
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
        alreadySubmitted: !!latestSubmission,
        submittedAtText: latestSubmission
          ? format(latestSubmission.submittedAt, "yyyy-MM-dd HH:mm")
          : null,
        submissionSummary,
        adminEditHistory,
      }}
      facilities={filteredFacilities}
    />
  );
}
