import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const patchSchema = z.object({
  monthlyLimit: z.number().int().min(0).max(31).optional(),
  defaultSchedule: z.string().optional(),
  allowedFacilityIds: z.string().optional(),
  loginId: z.string().trim().min(1).optional(),
  password: z.string().min(4).optional(),
  managementNumber: z.number().int().min(1).nullable().optional(),
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
    loginId?: string;
    passwordHash?: string;
    managementNumber?: number | null;
  } = {};
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

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
  if (parsed.data.loginId !== undefined) {
    const conflict = await prisma.user.findUnique({
      where: { loginId: parsed.data.loginId },
      select: { id: true },
    });
    if (conflict && conflict.id !== userId) {
      return NextResponse.json({ error: "login_id_already_exists" }, { status: 409 });
    }
    data.loginId = parsed.data.loginId;
  }
  if (parsed.data.password !== undefined) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }
  if (parsed.data.managementNumber !== undefined) {
    if (parsed.data.managementNumber !== null) {
      const conflict = await prisma.user.findFirst({
        where: {
          managementNumber: parsed.data.managementNumber,
          id: { not: userId },
        },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json({ error: "management_number_already_exists" }, { status: 409 });
      }
    }
    data.managementNumber = parsed.data.managementNumber;
  }

  await prisma.user.update({
    where: { id: userId },
    data,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, loginId: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "cannot_delete_admin" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.deleteMany({ where: { userId: target.id } });
    await tx.user.delete({ where: { id: target.id } });
  });

  return NextResponse.json({ ok: true });
}
