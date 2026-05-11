import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * admin100 … admin105 を upsert（既存なら上書き）。メインの seed 成否に依存しない。
 * パスワードは既存の admin デモと同じ opa1224。
 */
export async function ensureExtraAdminUsers(prisma: PrismaClient): Promise<void> {
  const facilities = await prisma.facility.findMany({
    select: { id: true },
    orderBy: { name: "asc" },
  });
  const allowedFacilityIds = JSON.stringify(facilities.map((f) => f.id));
  const adminPasswordHash = await bcrypt.hash("opa1224", 10);
  const extraAdmins = [100, 101, 102, 103, 104, 105] as const;

  for (const n of extraAdmins) {
    const loginId = `admin${n}`;
    const fields = {
      name: `デモ管理者${n}`,
      passwordHash: adminPasswordHash,
      defaultSchedule: "{}",
      allowedFacilityIds,
      monthlyLimit: 31,
      role: "ADMIN" as const,
    };
    await prisma.user.upsert({
      where: { loginId },
      update: fields,
      create: { loginId, ...fields },
    });
  }

  console.log(
    "[ensure-extra-admins] OK:",
    extraAdmins.map((n) => `admin${n}`).join(", ")
  );
}
