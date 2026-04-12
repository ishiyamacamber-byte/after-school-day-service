import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { insertAdminEditLogRaw } from "@/lib/application-admin-edit-log";
import { appendApplicationRows } from "@/lib/google-sheets";
import { prisma } from "@/lib/prisma";
import { isDateInMonthKey, monthEndExclusive, monthStart } from "@/lib/month";

const bodySchema = z.object({
  userId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});
const patchBodySchema = z.object({
  userId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  days: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        facilityId: z.string().min(1),
        notes: z.string().optional(),
      })
    )
    .min(1),
  overallNotes: z.string().optional(),
});

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const start = monthStart(parsed.data.month);
  const end = monthEndExclusive(parsed.data.month);

  const result = await prisma.application.deleteMany({
    where: {
      userId: parsed.data.userId,
      submittedAt: { gte: start, lt: end },
    },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { userId, month, days, overallNotes } = parsed.data;
  if (days.some((d) => !isDateInMonthKey(d.date, month))) {
    return NextResponse.json({ error: "invalid_date_month" }, { status: 400 });
  }
  const uniqDays = new Set(days.map((d) => d.date));
  if (uniqDays.size !== days.length) {
    return NextResponse.json({ error: "duplicate_date" }, { status: 400 });
  }

  const [user, facilities] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, loginId: true },
    }),
    prisma.facility.findMany({
      where: { id: { in: [...new Set(days.map((d) => d.facilityId))] } },
      select: { id: true, name: true },
    }),
  ]);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (facilities.length !== new Set(days.map((d) => d.facilityId)).size) {
    return NextResponse.json({ error: "facility_not_found" }, { status: 400 });
  }

  const start = monthStart(month);
  const end = monthEndExclusive(month);
  const groupId = crypto.randomUUID();
  const submittedAt = new Date();
  const hasOverall = !!overallNotes?.trim();

  const editorId = session.user.id;
  const editor = await prisma.user.findUnique({
    where: { id: editorId },
    select: { name: true, loginId: true },
  });
  if (!editor) {
    return NextResponse.json({ error: "editor_not_found" }, { status: 401 });
  }

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const snapshotPayload = {
    days: sortedDays.map((d) => ({
      date: d.date,
      facilityId: d.facilityId,
      notes: d.notes?.trim() ?? "",
    })),
    overallNotes: overallNotes?.trim() ?? "",
  };

  await prisma.$transaction(async (tx) => {
    await tx.application.deleteMany({
      where: { userId, submittedAt: { gte: start, lt: end } },
    });
    if (hasOverall) {
      await tx.application.create({
        data: {
          userId,
          groupId,
          date: null,
          facilityId: null,
          transport: null,
          notes: overallNotes?.trim() || null,
          submittedAt,
        },
      });
    }
    await tx.application.createMany({
      data: days.map((d) => ({
        userId,
        groupId,
        date: new Date(`${d.date}T12:00:00`),
        facilityId: d.facilityId,
        transport: null,
        notes: d.notes?.trim() || null,
        submittedAt,
      })),
    });
    await insertAdminEditLogRaw(tx, {
      targetUserId: userId,
      month,
      editorUserId: editorId,
      editorName: editor.name,
      editorLoginId: editor.loginId,
      editedAt: submittedAt,
      snapshotJson: JSON.stringify(snapshotPayload),
    });
  });

  const facilityName = (id: string) => facilities.find((f) => f.id === id)?.name ?? id;
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
    return NextResponse.json({ error: "sheets_append_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

