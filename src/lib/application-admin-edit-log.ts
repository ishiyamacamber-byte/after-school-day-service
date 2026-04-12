import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export type AdminEditLogRow = {
  id: string;
  editedAt: Date;
  editorName: string;
  editorLoginId: string;
  snapshotJson: string;
};

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Prisma クライアント未再生成環境でも動作するよう raw SQL で取得 */
export async function queryAdminEditLogsForTargetMonth(
  prisma: Pick<PrismaClient, "$queryRaw">,
  targetUserId: string,
  month: string,
  opts?: { sort?: "asc" | "desc"; limit?: number }
): Promise<AdminEditLogRow[]> {
  const sort = opts?.sort === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const lim = opts?.limit != null && opts.limit > 0 ? opts.limit : null;
  if (lim != null) {
    return prisma.$queryRaw<AdminEditLogRow[]>(Prisma.sql`
      SELECT
        "id" AS "id",
        "edited_at" AS "editedAt",
        "editor_name" AS "editorName",
        "editor_login_id" AS "editorLoginId",
        "snapshot_json" AS "snapshotJson"
      FROM "application_admin_edit_logs"
      WHERE "target_user_id" = ${targetUserId} AND "month" = ${month}
      ORDER BY "edited_at" ${sort}
      LIMIT ${lim}
    `);
  }
  return prisma.$queryRaw<AdminEditLogRow[]>(Prisma.sql`
    SELECT
      "id" AS "id",
      "edited_at" AS "editedAt",
      "editor_name" AS "editorName",
      "editor_login_id" AS "editorLoginId",
      "snapshot_json" AS "snapshotJson"
    FROM "application_admin_edit_logs"
    WHERE "target_user_id" = ${targetUserId} AND "month" = ${month}
    ORDER BY "edited_at" ${sort}
  `);
}

export async function insertAdminEditLogRaw(
  tx: Tx,
  input: {
    targetUserId: string;
    month: string;
    editorUserId: string;
    editorName: string;
    editorLoginId: string;
    editedAt: Date;
    snapshotJson: string;
  }
): Promise<void> {
  const id = randomUUID();
  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO "application_admin_edit_logs" (
        "id",
        "target_user_id",
        "month",
        "editor_user_id",
        "editor_name",
        "editor_login_id",
        "edited_at",
        "snapshot_json"
      )
      VALUES (
        ${id},
        ${input.targetUserId},
        ${input.month},
        ${input.editorUserId},
        ${input.editorName},
        ${input.editorLoginId},
        ${input.editedAt},
        ${input.snapshotJson}
      )
    `
  );
}
