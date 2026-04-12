"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 active:bg-slate-100"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      ログアウト
    </button>
  );
}
