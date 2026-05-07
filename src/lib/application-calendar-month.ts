import type { Prisma, PrismaClient } from "@prisma/client";
import { monthEndExclusive, monthStart } from "@/lib/month";

type Db = Pick<PrismaClient, "application">;

/**
 * 「yyy-mm で削除」ときの対象は、一覧・CSV と同じく利用日 Application.date がその月に入る行（および同一 groupId の全体連絡行）。
 *
 * submittedAt でフォールバックしない（利用日が翌月だが月末に提出した等とずれるため、「指定月」と体感が一致しない／誤削除の原因になる）。
 */
export async function whereApplicationsForCalendarMonth(
  db: Db,
  monthKey: string,
  opts?: { userId?: string }
): Promise<Prisma.ApplicationWhereInput> {
  const start = monthStart(monthKey);
  const end = monthEndExclusive(monthKey);
  const userClause: Prisma.ApplicationWhereInput = opts?.userId ? { userId: opts.userId } : {};

  const datedInMonth = await db.application.findMany({
    where: { ...userClause, date: { gte: start, lt: end } },
    select: { groupId: true },
  });
  const groupIds = [...new Set(datedInMonth.map((r) => r.groupId))];

  if (groupIds.length === 0) {
    return { ...userClause, date: { gte: start, lt: end } };
  }

  return {
    ...userClause,
    OR: [{ date: { gte: start, lt: end } }, { groupId: { in: groupIds } }],
  };
}

export async function deleteApplicationsForCalendarMonth(db: Db, monthKey: string, opts?: { userId?: string }) {
  const where = await whereApplicationsForCalendarMonth(db, monthKey, opts);
  return db.application.deleteMany({ where });
}
