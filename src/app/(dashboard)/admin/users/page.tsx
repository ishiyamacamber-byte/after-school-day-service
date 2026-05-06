import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CreateUserForm } from "@/components/admin/create-user-form";

function parseAllowedIds(raw: string): string[] {
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ sortAllowedFacility?: string }>;
}) {
  const sp = await searchParams;
  const sortAllowedFacility = (sp.sortAllowedFacility ?? "").trim();

  const [usersRaw, facilities] = await Promise.all([
    prisma.user.findMany({
      orderBy: { loginId: "asc" },
      select: {
        id: true,
        name: true,
        loginId: true,
        monthlyLimit: true,
        role: true,
        allowedFacilityIds: true,
      },
    }),
    prisma.facility.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const users = [...usersRaw].sort((a, b) => {
    if (!sortAllowedFacility) return a.loginId.localeCompare(b.loginId);
    const aAllowed = parseAllowedIds(a.allowedFacilityIds).includes(sortAllowedFacility);
    const bAllowed = parseAllowedIds(b.allowedFacilityIds).includes(sortAllowedFacility);
    if (aAllowed !== bAllowed) return aAllowed ? -1 : 1;
    return a.loginId.localeCompare(b.loginId);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-900">利用者・設定</h1>
        <Link
          href="/admin/import"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 active:bg-slate-50"
        >
          CSV取込
        </Link>
      </div>
      <CreateUserForm />
      <form method="get" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <label className="text-sm font-medium text-slate-700">
          並び替え（利用可能事業所）
          <select
            name="sortAllowedFacility"
            defaultValue={sortAllowedFacility}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
          >
            <option value="">指定なし（ログインID順）</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="mt-3 min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          適用
        </button>
      </form>
      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li key={u.id}>
            <Link
              href={`/admin/users/${u.id}`}
              className="flex min-h-14 items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
            >
              <span className="font-medium text-slate-900">{u.name}</span>
              <span className="text-sm text-slate-600">
                {u.loginId} · 上限{u.monthlyLimit}日 · {u.role}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
