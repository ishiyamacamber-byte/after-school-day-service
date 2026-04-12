import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  monthlyLimit: z.number().int().min(0).max(31).optional(),
  defaultSchedule: z.string().optional(),
  allowedFacilityIds: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const data: {
    monthlyLimit?: number;
    defaultSchedule?: string;
    allowedFacilityIds?: string;
  } = {};
  if (parsed.data.monthlyLimit !== undefined) data.monthlyLimit = parsed.data.monthlyLimit;
  if (parsed.data.defaultSchedule !== undefined) {
    try {
      JSON.parse(parsed.data.defaultSchedule);
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    data.defaultSchedule = parsed.data.defaultSchedule;
  }
  if (parsed.data.allowedFacilityIds !== undefined) {
    let ids: unknown;
    try {
      ids = JSON.parse(parsed.data.allowedFacilityIds);
    } catch {
      return NextResponse.json({ error: "invalid_allowed_facility_ids_json" }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.some((v) => typeof v !== "string")) {
      return NextResponse.json({ error: "invalid_allowed_facility_ids_shape" }, { status: 400 });
    }
    const count = await prisma.facility.count({
      where: { id: { in: ids as string[] } },
    });
    if (count !== (ids as string[]).length) {
      return NextResponse.json({ error: "unknown_facility_id_in_allowed_facility_ids" }, { status: 400 });
    }
    data.allowedFacilityIds = parsed.data.allowedFacilityIds;
  }

  await prisma.user.update({
    where: { id: userId },
    data,
  });

  return NextResponse.json({ ok: true });
}
