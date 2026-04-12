import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <span className="truncate text-sm font-semibold text-slate-800">利用予定申請</span>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/apply"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-blue-700"
          >
            申請
          </Link>
          {session.user.role === "ADMIN" && (
            <>
              <Link
                href="/admin/users"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 active:bg-slate-50"
              >
                管理
              </Link>
              <Link
                href="/admin/applications"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 active:bg-slate-50"
              >
                一覧
              </Link>
              <Link
                href="/admin/import"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 active:bg-slate-50"
              >
                取込
              </Link>
            </>
          )}
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
