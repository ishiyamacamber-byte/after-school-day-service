import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateYmdJapan } from "@/lib/datetime-japan";
import { getNonApplicableDatesForMonth } from "@/lib/non-applicable-days";
import { NonApplicableDaysAdminClient } from "@/components/admin/non-applicable-days-admin-client";

export default async function AdminNonApplicableDaysPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/apply");

  const openMonthConfig = await prisma.systemConfig.findUnique({ where: { key: "open_month" } });
  const initialMonth = openMonthConfig?.value ?? formatDateYmdJapan(new Date()).slice(0, 7);
  const initialDates = await getNonApplicableDatesForMonth(prisma, initialMonth);

  return <NonApplicableDaysAdminClient initialMonth={initialMonth} initialDates={initialDates} />;
}
