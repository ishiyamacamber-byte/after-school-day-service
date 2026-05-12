/**
 * 本番 Docker 用: tsx / npx 追加取得に依存せず node のみで実行する。
 *   node prisma/ensure-extra-admins.cjs
 *
 * admin100 … admin105 を upsert。パスワードは admin デモと同じ opa1224。
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

/** @param {import("@prisma/client").PrismaClient} prisma */
async function ensureExtraAdminUsers(prisma) {
  const facilities = await prisma.facility.findMany({
    select: { id: true },
    orderBy: { name: "asc" },
  });
  const allowedFacilityIds = JSON.stringify(facilities.map((f) => f.id));
  const adminPasswordHash = await bcrypt.hash("opa1224", 10);
  const extraAdmins = [100, 101, 102, 103, 104, 105];

  for (const n of extraAdmins) {
    const loginId = `admin${n}`;
    const fields = {
      name: `デモ管理者${n}`,
      passwordHash: adminPasswordHash,
      defaultSchedule: "{}",
      allowedFacilityIds,
      monthlyLimit: 31,
      role: "ADMIN",
    };
    await prisma.user.upsert({
      where: { loginId },
      update: fields,
      create: { loginId, ...fields },
    });
  }

  console.log("[ensure-extra-admins] OK:", extraAdmins.map((n) => `admin${n}`).join(", "));
}

async function main() {
  if (process.env.SKIP_ENSURE_EXTRA_ADMINS === "1") {
    console.log("[ensure-extra-admins] skipped (SKIP_ENSURE_EXTRA_ADMINS=1)");
    return;
  }
  const prisma = new PrismaClient();
  try {
    await ensureExtraAdminUsers(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[ensure-extra-admins] failed:", e);
    process.exit(1);
  });
}

module.exports = { ensureExtraAdminUsers };
