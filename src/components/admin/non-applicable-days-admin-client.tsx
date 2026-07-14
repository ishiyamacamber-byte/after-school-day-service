"use client";

import { useMemo, useState } from "react";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function monthLabelJa(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${y}年${m}月`;
}

function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function NonApplicableDaysAdminClient({
  initialMonth,
  initialDates,
}: {
  initialMonth: string;
  initialDates: string[];
}) {
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialDates));
  const [savedSnapshot, setSavedSnapshot] = useState(() => [...initialDates].sort().join(","));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [year, monthIndex] = month.split("-").map(Number);
  const firstDow = new Date(year, monthIndex - 1, 1).getDay();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();

  const sortedSelected = useMemo(() => [...selected].sort(), [selected]);
  const dirty = sortedSelected.join(",") !== savedSnapshot;

  async function loadMonth(targetMonth: string) {
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/admin/non-applicable-days?month=${encodeURIComponent(targetMonth)}`, {
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { dates?: string[]; error?: string };
    setBusy(false);
    if (!res.ok || !Array.isArray(json.dates)) {
      setMessage("一覧の取得に失敗しました。");
      return;
    }
    setMonth(targetMonth);
    const next = new Set(json.dates);
    setSelected(next);
    setSavedSnapshot([...json.dates].sort().join(","));
  }

  function toggleDay(day: number) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
    setMessage("");
  }

  async function onSave() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/non-applicable-days", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, dates: sortedSelected }),
    });
    const json = (await res.json().catch(() => ({}))) as { dates?: string[]; error?: string };
    setBusy(false);
    if (!res.ok || !Array.isArray(json.dates)) {
      setMessage("保存に失敗しました。");
      return;
    }
    setSelected(new Set(json.dates));
    setSavedSnapshot([...json.dates].sort().join(","));
    setMessage(
      json.dates.length === 0
        ? `${monthLabelJa(month)}の申請不可日をすべて解除しました。`
        : `${monthLabelJa(month)}の申請不可日を ${json.dates.length} 日保存しました。`
    );
  }

  async function clearMonth() {
    if (!confirm(`${monthLabelJa(month)}の申請不可日をすべて解除します。よろしいですか？`)) return;
    setSelected(new Set());
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/non-applicable-days", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, dates: [] }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage("解除に失敗しました。");
      return;
    }
    setSavedSnapshot("");
    setMessage(`${monthLabelJa(month)}の申請不可日をすべて解除しました。`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-lg font-bold text-slate-900">申請不可日の管理</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          年末年始など、利用者が選択できない日を設定します。カレンダー上で日付をタップして選択／解除し、「保存」してください。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => loadMonth(shiftMonth(month, -1))}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            前月
          </button>
          <input
            type="month"
            value={month}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value;
              if (/^\d{4}-\d{2}$/.test(next)) void loadMonth(next);
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-base font-semibold text-slate-900"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => loadMonth(shiftMonth(month, 1))}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            翌月
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-700">
          管理中: <span className="font-bold text-slate-900">{monthLabelJa(month)}</span>（{month}）
          {dirty ? <span className="ml-2 text-amber-700">（未保存の変更あり）</span> : null}
        </p>
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="text-sm font-semibold text-slate-900">カレンダーで選択</p>
        <p className="mt-1 text-xs text-slate-600">
          赤い日付が申請不可日です。再度タップすると解除できます。
        </p>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w, idx) => (
              <div
                key={w}
                className={`rounded-md py-1 text-center text-[10px] font-bold ${
                  idx === 0
                    ? "bg-red-50 text-red-700"
                    : idx === 6
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }, (_, i) => (
              <div key={`pad-${i}`} className="min-h-[3.25rem] rounded-md bg-transparent" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const date = `${month}-${String(day).padStart(2, "0")}`;
              const isBlocked = selected.has(date);
              return (
                <button
                  key={date}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleDay(day)}
                  className={`min-h-[3.25rem] rounded-md border p-1 text-left disabled:opacity-60 ${
                    isBlocked
                      ? "border-rose-400 bg-rose-100"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className={`text-xs font-bold ${isBlocked ? "text-rose-900" : "text-slate-700"}`}>
                    {day}
                  </div>
                  <div className={`mt-0.5 text-[10px] leading-tight ${isBlocked ? "text-rose-800" : "text-transparent"}`}>
                    不可
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => void onSave()}
            className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "処理中..." : "保存"}
          </button>
          <button
            type="button"
            disabled={busy || (sortedSelected.length === 0 && !dirty)}
            onClick={() => void clearMonth()}
            className="min-h-11 rounded-xl border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700 disabled:opacity-50"
          >
            この月をすべて解除
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          <p className="font-semibold text-slate-900">
            選択中（{sortedSelected.length}日）
          </p>
          {sortedSelected.length === 0 ? (
            <p className="mt-1 text-xs text-slate-600">この月の申請不可日はありません。</p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-slate-700">
              {sortedSelected.map((d) => d.slice(8)).join("日、")}日
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
