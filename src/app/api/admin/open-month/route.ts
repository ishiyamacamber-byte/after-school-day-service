import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  openMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  await prisma.systemConfig.upsert({
    where: { key: "open_month" },
    update: { value: parsed.data.openMonth },
    create: { key: "open_month", value: parsed.data.openMonth },
  });

  return NextResponse.json({ ok: true, openMonth: parsed.data.openMonth });
}

