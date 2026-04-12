import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { loginId: "asc" },
    select: { id: true, name: true, loginId: true, monthlyLimit: true, role: true },
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
