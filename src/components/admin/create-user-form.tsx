"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateUserForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("password");
  const [monthlyLimit, setMonthlyLimit] = useState(12);
  const [managementNumber, setManagementNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        loginId,
        password,
        monthlyLimit,
        managementNumber: managementNumber ? Number(managementNumber) : undefined,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      if (j.error === "login_id_already_exists") {
        setMsg("このログインIDは既に使われています。");
        return;
      }
      if (j.error === "management_number_already_exists") {
        setMsg("この管理番号は既に使われています。");
        return;
      }
      setMsg("新規利用者の登録に失敗しました。");
      return;
    }
    setMsg("新規利用者を登録しました。");
    setName("");
    setLoginId("");
    setPassword("password");
    setMonthlyLimit(12);
    setManagementNumber("");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <p className="text-sm font-semibold text-slate-900">新規利用者を登録</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          氏名
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          ログインID
          <input
            required
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          初期パスワード
          <input
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          月上限（日）
          <input
            type="number"
            min={0}
            max={31}
            required
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(Math.max(0, Math.min(31, Number(e.target.value) || 0)))}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          管理番号（空なら自動）
          <input
            type="number"
            min={1}
            value={managementNumber}
            onChange={(e) => setManagementNumber(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
          />
        </label>
      </div>
      {msg && <p className="mt-3 text-sm text-slate-800">{msg}</p>}
      <button
        type="submit"
        disabled={saving}
        className="mt-3 min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "登録中..." : "利用者を登録"}
      </button>
    </form>
  );
}
