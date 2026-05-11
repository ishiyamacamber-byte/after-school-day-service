import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureExtraAdminUsers } from "./ensure-extra-admins-logic";

const prisma = new PrismaClient();

async function main() {
  const existingUsers = await prisma.user.count();
  const skipFullSeed = existingUsers > 0 && process.env.FORCE_SEED !== "1";
  if (skipFullSeed) {
    console.log(
      "Seed skipped: users already exist. Set FORCE_SEED=1 to re-run full seed."
    );
  }
  if (!skipFullSeed) {

  const facilitySeeds = [
    { id: "seed-fac-1", name: "オーパ", sortOrder: 10 },
    { id: "seed-fac-2", name: "セカンド", sortOrder: 20 },
    { id: "seed-fac-3", name: "サード", sortOrder: 30 },
    { id: "seed-fac-4", name: "ネクスト", sortOrder: 40 },
    { id: "seed-fac-5", name: "アスリート", sortOrder: 50 },
    { id: "seed-fac-6", name: "チャレンジ", sortOrder: 60 },
    { id: "seed-fac-7", name: "ステップ", sortOrder: 70 },
  ] as const;

  const facilities = await Promise.all(
    facilitySeeds.map((f) =>
      prisma.facility.upsert({
        where: { id: f.id },
        update: { name: f.name, sortOrder: f.sortOrder },
        create: { id: f.id, name: f.name, sortOrder: f.sortOrder },
      })
    )
  );

  const defaultSchedule = JSON.stringify({
    "1": facilities[0].id,
    "2": facilities[1].id,
    "3": facilities[2].id,
    "4": facilities[3].id,
    "5": facilities[4].id,
  });

  const userPasswordHash = await bcrypt.hash("password", 10);
  const adminPasswordHash = await bcrypt.hash("opa1224", 10);
  const now = new Date();
  const openMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const demoFields = {
    name: "デモ利用者",
    passwordHash: userPasswordHash,
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
    passwordHash: adminPasswordHash,
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

  await ensureExtraAdminUsers(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
