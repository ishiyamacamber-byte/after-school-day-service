import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthEndExclusive, monthStart } from "@/lib/month";
import { Prisma } from "@prisma/client";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { session: null, error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
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
  const start = monthStart(month);
  const end = monthEndExclusive(month);

  const whereApp = { submittedAt: { gte: start, lt: end } as const };

  const [applicationRowCount, byUser, logAgg] = await Promise.all([
    prisma.application.count({ where: whereApp }),
    prisma.application.groupBy({
      by: ["userId"],
      where: whereApp,
    }),
    prisma.$queryRaw<[{ n: bigint }]>(Prisma.sql`
      SELECT COUNT(*) AS n FROM "application_admin_edit_logs" WHERE "month" = ${month}
    `),
  ]);

  const editLogCount = Number(logAgg[0]?.n ?? 0);

  return NextResponse.json({
    month,
    applicationRowCount,
    userCount: byUser.length,
    editLogCount,
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const json = await req.json().catch(() => null);
  const parsed = z.object({ month: monthSchema }).safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { month } = parsed.data;
  const start = monthStart(month);
  const end = monthEndExclusive(month);

  const deletedApplications = await prisma.$transaction(async (tx) => {
    const r = await tx.application.deleteMany({
      where: { submittedAt: { gte: start, lt: end } },
    });
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM "application_admin_edit_logs" WHERE "month" = ${month}
    `);
    return r.count;
  });

  return NextResponse.json({
    ok: true,
    month,
    deletedApplicationRows: deletedApplications,
  });
}
