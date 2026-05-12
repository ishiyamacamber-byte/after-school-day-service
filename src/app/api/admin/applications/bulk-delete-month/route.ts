import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { deleteApplicationsForCalendarMonth, whereApplicationsForCalendarMonth } from "@/lib/application-calendar-month";
import { prisma } from "@/lib/prisma";
import { removeScheduleImage } from "@/lib/schedule-image-storage";
import { removeNewsletterImage } from "@/lib/newsletter-image-storage";
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

  const whereApp = await whereApplicationsForCalendarMonth(prisma, month);

  const [applicationRowCount, byUser, logAgg, scheduleImageCount, newsletterImageCount] = await Promise.all([
    prisma.application.count({ where: whereApp }),
    prisma.application.groupBy({
      by: ["userId"],
      where: whereApp,
    }),
    prisma.$queryRaw<[{ n: bigint }]>(Prisma.sql`
      SELECT COUNT(*) AS n FROM "application_admin_edit_logs" WHERE "month" = ${month}
    `),
    prisma.facilityMonthlyScheduleImage.count({ where: { month } }),
    prisma.facilityMonthlyNewsletterImage.count({ where: { month } }),
  ]);

  const editLogCount = Number(logAgg[0]?.n ?? 0);

  return NextResponse.json({
    month,
    applicationRowCount,
    userCount: byUser.length,
    editLogCount,
    scheduleImageCount,
    newsletterImageCount,
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

  const deleted = await prisma.$transaction(async (tx) => {
    const scheduleRows = await tx.facilityMonthlyScheduleImage.findMany({
      where: { month },
      select: { filePath: true },
    });
    const newsletterRows = await tx.facilityMonthlyNewsletterImage.findMany({
      where: { month },
      select: { filePath: true },
    });
    const r = await deleteApplicationsForCalendarMonth(tx, month);
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM "application_admin_edit_logs" WHERE "month" = ${month}
    `);
    await tx.facilityMonthlyScheduleImage.deleteMany({ where: { month } });
    await tx.facilityMonthlyNewsletterImage.deleteMany({ where: { month } });
    return { deletedApplications: r.count, scheduleRows, newsletterRows };
  });

  let scheduleImageDeleteWarning: string | undefined;
  try {
    await Promise.all(deleted.scheduleRows.map((r) => removeScheduleImage(r.filePath)));
  } catch (e) {
    console.error(e);
    scheduleImageDeleteWarning = "schedule_image_file_delete_failed";
  }

  let newsletterImageDeleteWarning: string | undefined;
  try {
    await Promise.all(deleted.newsletterRows.map((r) => removeNewsletterImage(r.filePath)));
  } catch (e) {
    console.error(e);
    newsletterImageDeleteWarning = "newsletter_image_file_delete_failed";
  }

  return NextResponse.json({
    ok: true,
    month,
    deletedApplicationRows: deleted.deletedApplications,
    deletedScheduleImages: deleted.scheduleRows.length,
    deletedNewsletterImages: deleted.newsletterRows.length,
    ...(scheduleImageDeleteWarning ? { warning: scheduleImageDeleteWarning } : {}),
    ...(newsletterImageDeleteWarning ? { newsletterWarning: newsletterImageDeleteWarning } : {}),
  });
}
