"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

type Facility = { id: string; name: string };

export function UserSettingsForm({
  user,
  facilities,
}: {
  user: {
    id: string;
    name: string;
    loginId: string;
    defaultSchedule: string;
    allowedFacilityIds: string;
    monthlyLimit: number;
    role: string;
  };
  facilities: Facility[];
}) {
  const router = useRouter();
  const [monthlyLimit, setMonthlyLimit] = useState(user.monthlyLimit);
  const [byWeekday, setByWeekday] = useState<Record<number, string>>(() => {
    try {
      const m = JSON.parse(user.defaultSchedule) as Record<string, string>;
      const out: Record<number, string> = {};
      for (let i = 0; i < 7; i++) {
        const v = m[String(i)];
        if (v) out[i] = v;
      }
      return out;
    } catch {
      return {};
    }
  });
  const [allowedFacilityIds, setAllowedFacilityIds] = useState<string[]>(() => {
    try {
      const list = JSON.parse(user.allowedFacilityIds) as string[];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    const default_schedule: Record<string, string> = {};
    for (let i = 0; i < 7; i++) {
      const v = byWeekday[i];
      if (v) default_schedule[String(i)] = v;
    }
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlyLimit,
        defaultSchedule: JSON.stringify(default_schedule),
        allowedFacilityIds: JSON.stringify(allowedFacilityIds),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg("保存に失敗しました。");
      return;
    }
    setMsg("保存しました。");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{user.name}</h1>
        <p className="text-sm text-slate-600">
          {user.loginId} · {user.role}
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
        月の上限利用日数
        <input
          type="number"
          min={0}
          className="min-h-12 rounded-xl border border-slate-300 px-3 text-base"
          value={monthlyLimit}
          onChange={(e) => setMonthlyLimit(Number(e.target.value))}
        />
      </label>

      <div>
        <h2 className="text-base font-semibold text-slate-900">デフォルト曜日と事業所</h2>
        <p className="mt-1 text-xs text-slate-600">
          カレンダーでは、該当曜日にここで選んだ事業所が初期表示されます（あとから変更可能）。
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {weekdayLabels.map((label, i) => (
            <label key={label} className="flex items-center gap-3 text-sm">
              <span className="w-8 font-medium text-slate-700">{label}</span>
              <select
                className="min-h-12 flex-1 rounded-xl border border-slate-300 px-3 text-base"
                value={byWeekday[i] ?? ""}
                onChange={(e) =>
                  setByWeekday((prev) => {
                    const next = { ...prev };
                    if (e.target.value) next[i] = e.target.value;
                    else delete next[i];
                    return next;
                  })
                }
              >
                <option value="">（未設定）</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-900">利用可能な事業所</h2>
        <p className="mt-1 text-xs text-slate-600">利用者が申請時に選べる事業所を制限します。</p>
        <div className="mt-3 flex flex-col gap-2">
          {facilities.map((f) => (
            <label key={f.id} className="flex items-center gap-3 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300"
                checked={allowedFacilityIds.includes(f.id)}
                onChange={(e) =>
                  setAllowedFacilityIds((prev) =>
                    e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id)
                  )
                }
              />
              <span>{f.name}</span>
            </label>
          ))}
        </div>
      </div>

      {msg && <p className="text-sm text-slate-800">{msg}</p>}

      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="min-h-14 rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-60"
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
