/**
 * 単体実行: npx tsx prisma/run-ensure-extra-admins.ts
 * Docker: db push の直後に呼ぶと seed 失敗の有無に関わらず管理者が揃う。
 */
import { PrismaClient } from "@prisma/client";
import { ensureExtraAdminUsers } from "./ensure-extra-admins-logic";

async function main() {
  const prisma = new PrismaClient();
  try {
    await ensureExtraAdminUsers(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[ensure-extra-admins] failed:", e);
  process.exit(1);
});
