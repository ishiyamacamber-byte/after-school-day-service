import type { Prisma } from "@prisma/client";

/** 事業所をドロップダウン・一覧に並べるときの既定順（管理者が sortOrder で変更可能） */
export const FACILITY_LIST_ORDER_BY: Prisma.FacilityOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { name: "asc" },
];
