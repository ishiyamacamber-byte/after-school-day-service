import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appendApplicationRows } from "@/lib/google-sheets";
import { isDateInMonthKey, monthEndExclusive, monthStart, toMonthKey } from "@/lib/month";

const daySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  facilityId: z.string().min(1),
  notes: z.string().optional(),
});

const bodySchema = z.object({
  days: z.array(daySchema).min(1),
  overallNotes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { days, overallNotes } = parsed.data;
  const groupId = crypto.randomUUID();
  const submittedAt = new Date();
  const openMonthConfig = await prisma.systemConfig.findUnique({ where: { key: "open_month" } });
  const openMonth = openMonthConfig?.value ?? toMonthKey(new Date());
  const [start, end] = [monthStart(openMonth), monthEndExclusive(openMonth)];
  const already = await prisma.application.findFirst({
    where: {
      userId: session.user.id,
      submittedAt: { gte: start, lt: end },
    },
    select: { id: true },
  });
  if (already) {
    return NextResponse.json({ error: "already_submitted_for_month" }, { status: 409 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, loginId: true, allowedFacilityIds: true },
  });
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (days.some((d) => !isDateInMonthKey(d.date, openMonth))) {
    return NextResponse.json({ error: "month_closed" }, { status: 400 });
  }

  const facilityIds = [...new Set(days.map((d) => d.facilityId))];
  const facilities = await prisma.facility.findMany({
    where: { id: { in: facilityIds } },
    select: { id: true, name: true },
  });
  const facilityName = (id: string) => facilities.find((f) => f.id === id)?.name ?? id;

  const allowedFacilityIds = (() => {
    try {
      return JSON.parse(user.allowedFacilityIds ?? "[]") as string[];
    } catch {
      return [] as string[];
    }
  })();
  if (allowedFacilityIds.length > 0 && days.some((d) => !allowedFacilityIds.includes(d.facilityId))) {
    return NextResponse.json({ error: "facility_not_allowed" }, { status: 400 });
  }

  const hasOverall = !!(overallNotes && overallNotes.trim());

  if (hasOverall) {
    await prisma.application.create({
      data: {
        userId: user.id,
        groupId,
        date: null,
        facilityId: null,
        transport: null,
        notes: overallNotes?.trim() || null,
        submittedAt,
      },
    });
  }
  await prisma.application.createMany({
    data: days.map((d) => ({
      userId: user.id,
      groupId,
      date: new Date(`${d.date}T12:00:00`),
      facilityId: d.facilityId,
      transport: null,
      notes: d.notes?.trim() || null,
      submittedAt,
    })),
  });

  const rows: Parameters<typeof appendApplicationRows>[0] = [];
  if (hasOverall) {
    rows.push({
      submittedAtIso: submittedAt.toISOString(),
      userName: user.name,
      loginId: user.loginId,
      groupId,
      date: "(全体)",
      facilityName: "",
      notes: overallNotes?.trim() ?? "",
    });
  }
  for (const d of days) {
    rows.push({
      submittedAtIso: submittedAt.toISOString(),
      userName: user.name,
      loginId: user.loginId,
      groupId,
      date: d.date,
      facilityName: facilityName(d.facilityId),
      notes: d.notes?.trim() ?? "",
    });
  }

  try {
    await appendApplicationRows(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "sheets_append_failed", groupId }, { status: 502 });
  }

  return NextResponse.json({ ok: true, groupId });
}
