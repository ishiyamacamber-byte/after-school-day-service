import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { FacilitiesSettingsClient } from "@/components/admin/facilities-settings-client";
import { FACILITY_LIST_ORDER_BY } from "@/lib/facility-order";
import { prisma } from "@/lib/prisma";

export default async function AdminFacilitiesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/apply");

  const facilities = await prisma.facility.findMany({
    orderBy: FACILITY_LIST_ORDER_BY,
    select: { id: true, name: true, sortOrder: true },
  });

  return <FacilitiesSettingsClient facilities={facilities} />;
}
