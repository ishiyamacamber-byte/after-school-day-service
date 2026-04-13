"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      loginId,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("ログインIDまたはパスワードが正しくありません。");
      return;
    }
    router.replace("/apply");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <h1 className="mb-2 text-center text-xl font-bold text-slate-800">
        オーパグループ
      </h1>
      <p className="mb-8 text-center text-sm text-slate-600">利用予定申請（ログイン）</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          ログインID
          <input
            name="loginId"
            autoComplete="username"
            className="min-h-12 rounded-xl border border-slate-300 px-4 text-base outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          パスワード
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="min-h-12 rounded-xl border border-slate-300 px-4 text-base outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="min-h-14 rounded-xl bg-blue-600 text-base font-semibold text-white shadow active:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
