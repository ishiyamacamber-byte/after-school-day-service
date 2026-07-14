import type { PrismaClient } from "@prisma/client";
import { isDateInMonthKey } from "@/lib/month";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function isValidDateKey(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isValidMonthKey(month: string): boolean {
  return MONTH_RE.test(month);
}

export async function getNonApplicableDatesForMonth(
  prisma: Pick<PrismaClient, "nonApplicableDay">,
  month: string
): Promise<string[]> {
  if (!isValidMonthKey(month)) return [];
  const rows = await prisma.nonApplicableDay.findMany({
    where: { month },
    select: { date: true },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => r.date);
}

export async function getNonApplicableDateSetForMonth(
  prisma: Pick<PrismaClient, "nonApplicableDay">,
  month: string
): Promise<Set<string>> {
  const dates = await getNonApplicableDatesForMonth(prisma, month);
  return new Set(dates);
}

/** PUT 用: 指定月の申請不可日を置き換え */
export async function replaceNonApplicableDatesForMonth(
  prisma: PrismaClient,
  month: string,
  dates: string[]
): Promise<string[]> {
  if (!isValidMonthKey(month)) {
    throw new Error("invalid_month");
  }
  const unique = [...new Set(dates.filter((d) => isValidDateKey(d) && isDateInMonthKey(d, month)))].sort();

  await prisma.$transaction(async (tx) => {
    await tx.nonApplicableDay.deleteMany({ where: { month } });
    if (unique.length > 0) {
      await tx.nonApplicableDay.createMany({
        data: unique.map((date) => ({ date, month })),
      });
    }
  });

  return unique;
}
