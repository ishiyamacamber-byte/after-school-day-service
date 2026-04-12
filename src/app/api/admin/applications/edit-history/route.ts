import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { queryAdminEditLogsForTargetMonth } from "@/lib/application-admin-edit-log";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  targetUserId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    targetUserId: url.searchParams.get("targetUserId") ?? "",
    month: url.searchParams.get("month") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const { targetUserId, month } = parsed.data;

  const rows = await queryAdminEditLogsForTargetMonth(prisma, targetUserId, month, {
    sort: "desc",
    limit: 50,
  });

  const entries = rows.map((r) => {
    let snapshot: unknown = null;
    try {
      snapshot = JSON.parse(r.snapshotJson) as unknown;
    } catch {
      snapshot = null;
    }
    return {
      id: r.id,
      editorName: r.editorName,
      editorLoginId: r.editorLoginId,
      editedAtIso: r.editedAt.toISOString(),
      snapshot,
    };
  });

  return NextResponse.json({ entries });
}
