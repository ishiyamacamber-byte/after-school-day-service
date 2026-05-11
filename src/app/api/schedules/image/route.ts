import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readScheduleImage } from "@/lib/schedule-image-storage";

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const facilityId = (url.searchParams.get("facilityId") ?? "").trim();
  const month = (url.searchParams.get("month") ?? "").trim();
  if (!facilityId || !MONTH_RE.test(month)) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const row = await prisma.facilityMonthlyScheduleImage.findUnique({
    where: { facilityId_month: { facilityId, month } },
    select: { filePath: true },
  });
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await readScheduleImage(row.filePath).catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const bytes = new Uint8Array(body);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
    },
  });
}

