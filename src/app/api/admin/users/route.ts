import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const createSchema = z.object({
  name: z.string().trim().min(1),
  loginId: z.string().trim().min(1),
  password: z.string().min(4),
  monthlyLimit: z.number().int().min(0).max(31),
  managementNumber: z.number().int().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { name, loginId, password, monthlyLimit, managementNumber } = parsed.data;

  const [existingLogin, facilities] = await Promise.all([
    prisma.user.findUnique({ where: { loginId } }),
    prisma.facility.findMany({ select: { id: true } }),
  ]);
  if (existingLogin) {
    return NextResponse.json({ error: "login_id_already_exists" }, { status: 409 });
  }

  let assignedManagementNumber = managementNumber;
  if (assignedManagementNumber === undefined) {
    const agg = await prisma.user.aggregate({
      where: { role: "USER" },
      _max: { managementNumber: true },
    });
    assignedManagementNumber = (agg._max.managementNumber ?? 0) + 1;
  }

  const conflict = await prisma.user.findFirst({
    where: { role: "USER", managementNumber: assignedManagementNumber },
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json({ error: "management_number_already_exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: {
      name,
      loginId,
      passwordHash,
      monthlyLimit,
      managementNumber: assignedManagementNumber,
      role: "USER",
      defaultSchedule: "{}",
      allowedFacilityIds: JSON.stringify(facilities.map((f) => f.id)),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
