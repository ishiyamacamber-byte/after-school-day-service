import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getNonApplicableDatesForMonth,
  isValidMonthKey,
  replaceNonApplicableDatesForMonth,
} from "@/lib/non-applicable-days";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { error: null };
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
  const dates = await getNonApplicableDatesForMonth(prisma, month);
  return NextResponse.json({ month, dates });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const json = await req.json().catch(() => null);
  const parsed = z
    .object({
      month: monthSchema,
      dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    })
    .safeParse(json);
  if (!parsed.success || !isValidMonthKey(parsed.data.month)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const dates = await replaceNonApplicableDatesForMonth(
      prisma,
      parsed.data.month,
      parsed.data.dates
    );
    return NextResponse.json({ ok: true, month: parsed.data.month, dates });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
