import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchBodySchema = z.object({
  facilities: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(200),
      sortOrder: z.number().int(),
    })
  ),
});

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

  const existing = await prisma.facility.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((f) => f.id));
  const incomingIds = new Set(parsed.data.facilities.map((f) => f.id));

  if (incomingIds.size !== parsed.data.facilities.length) {
    return NextResponse.json({ error: "duplicate_facility_id" }, { status: 400 });
  }
  if (existingIds.size !== incomingIds.size) {
    return NextResponse.json({ error: "facility_count_mismatch" }, { status: 400 });
  }
  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      return NextResponse.json({ error: "missing_facility" }, { status: 400 });
    }
  }

  await prisma.$transaction(
    parsed.data.facilities.map((f) =>
      prisma.facility.update({
        where: { id: f.id },
        data: { name: f.name.trim(), sortOrder: f.sortOrder },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
