import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserSettingsForm } from "@/components/admin/user-settings-form";

export default async function AdminUserEditPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/apply");

  const { userId } = await params;
  const [user, facilities] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.facility.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!user) {
    return <p className="text-sm text-slate-600">ユーザーが見つかりません。</p>;
  }

  return (
    <UserSettingsForm
      user={{
        id: user.id,
        name: user.name,
        loginId: user.loginId,
        defaultSchedule: user.defaultSchedule,
        allowedFacilityIds: user.allowedFacilityIds,
        monthlyLimit: user.monthlyLimit,
        role: user.role,
      }}
      facilities={facilities}
    />
  );
}
