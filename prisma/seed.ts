import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0 && process.env.FORCE_SEED !== "1") {
    console.log(
      "Seed skipped: users already exist. Set FORCE_SEED=1 to re-run full seed."
    );
    return;
  }

  const facilities = await Promise.all([
    prisma.facility.upsert({
      where: { id: "seed-fac-1" },
      update: { name: "オーパ" },
      create: { id: "seed-fac-1", name: "オーパ" },
    }),
    prisma.facility.upsert({
      where: { id: "seed-fac-2" },
      update: { name: "セカンド" },
      create: { id: "seed-fac-2", name: "セカンド" },
    }),
    prisma.facility.upsert({
      where: { id: "seed-fac-3" },
      update: { name: "サード" },
      create: { id: "seed-fac-3", name: "サード" },
    }),
    prisma.facility.upsert({
      where: { id: "seed-fac-4" },
      update: { name: "ネクスト" },
      create: { id: "seed-fac-4", name: "ネクスト" },
    }),
    prisma.facility.upsert({
      where: { id: "seed-fac-5" },
      update: { name: "アスリート" },
      create: { id: "seed-fac-5", name: "アスリート" },
    }),
    prisma.facility.upsert({
      where: { id: "seed-fac-6" },
      update: { name: "チャレンジ" },
      create: { id: "seed-fac-6", name: "チャレンジ" },
    }),
    prisma.facility.upsert({
      where: { id: "seed-fac-7" },
      update: { name: "ステップ" },
      create: { id: "seed-fac-7", name: "ステップ" },
    }),
  ]);

  const defaultSchedule = JSON.stringify({
    "1": facilities[0].id,
    "2": facilities[1].id,
    "3": facilities[2].id,
    "4": facilities[3].id,
    "5": facilities[4].id,
  });

  const passwordHash = await bcrypt.hash("password", 10);
  const now = new Date();
  const openMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const demoFields = {
    name: "デモ利用者",
    passwordHash,
    defaultSchedule,
    allowedFacilityIds: JSON.stringify(facilities.map((f) => f.id)),
    monthlyLimit: 12,
    managementNumber: 1,
    role: "USER" as const,
  };

  await prisma.user.upsert({
    where: { loginId: "demo" },
    update: demoFields,
    create: {
      loginId: "demo",
      ...demoFields,
    },
  });

  const adminFields = {
    name: "デモ管理者",
    passwordHash,
    defaultSchedule: "{}",
    allowedFacilityIds: JSON.stringify(facilities.map((f) => f.id)),
    monthlyLimit: 31,
    role: "ADMIN" as const,
  };

  await prisma.user.upsert({
    where: { loginId: "admin" },
    update: adminFields,
    create: {
      loginId: "admin",
      ...adminFields,
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: "open_month" },
    update: { value: openMonth },
    create: { key: "open_month", value: openMonth },
  });

  console.log("Seed OK:", { facilities: facilities.length, openMonth });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
