"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type FacilityRow = { id: string; name: string; sortOrder: number };

export function FacilitiesSettingsClient({ facilities }: { facilities: FacilityRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<FacilityRow[]>(() =>
    [...facilities].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/facilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilities: rows }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("保存に失敗しました。画面を再読み込みしてからやり直してください。");
      return;
    }
    setMessage("保存しました。");
    router.refresh();
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= rows.length) return;
    setRows((prev) => {
      const copy = [...prev];
      const tmp = copy[next]!;
      copy[next] = copy[index]!;
      copy[index] = tmp;
      return copy.map((row, i) => ({ ...row, sortOrder: (i + 1) * 10 }));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-900">事業所の表示</h1>
        <Link
          href="/admin/users"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 active:bg-slate-50"
        >
          利用者へ
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="text-sm font-semibold text-slate-900">表示順・名称</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          <strong>表示順</strong>の数字が小さいほど、申請画面・管理画面のプルダウンなどで上に表示されます。{" "}
          <strong>名称</strong>は画面・CSV・スプレッドシートにそのまま出る表記です（内部IDは変わりません）。
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={saving || i === 0}
                  onClick={() => move(i, -1)}
                  className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 disabled:opacity-40"
                >
                  上へ
                </button>
                <button
                  type="button"
                  disabled={saving || i === rows.length - 1}
                  onClick={() => move(i, 1)}
                  className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 disabled:opacity-40"
                >
                  下へ
                </button>
              </div>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-700">
                名称
                <input
                  type="text"
                  value={r.name}
                  disabled={saving}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x))
                    )
                  }
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900"
                />
              </label>
              <label className="flex w-full shrink-0 flex-col gap-1 text-xs font-medium text-slate-700 sm:w-28">
                表示順
                <input
                  type="number"
                  inputMode="numeric"
                  value={r.sortOrder}
                  disabled={saving}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setRows((prev) =>
                      prev.map((x) => (x.id === r.id ? { ...x, sortOrder: Number.isFinite(n) ? n : 0 } : x))
                    );
                  }}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal tabular-nums text-slate-900"
                />
              </label>
              <p className="text-[10px] text-slate-500 sm:w-24">ID: {r.id.slice(0, 8)}…</p>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-4 min-h-11 w-full rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
        >
          {saving ? "保存中..." : "変更を保存"}
        </button>
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}
