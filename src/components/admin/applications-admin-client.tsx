"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type Row = {
  userId: string;
  hasSubmission: boolean;
  submittedAtText: string;
  userName: string;
  loginId: string;
  dayFacilities: Record<number, string[]>;
  overallNotes: string[];
  dailyNotes: string[];
  facilityCounts: Record<string, number>;
  facilityCountsList: { name: string; days: number }[];
  editableDays: { date: string; facilityId: string; notes: string }[];
  overallNotesText: string;
};

type User = { id: string; name: string; loginId: string };
type FacilityOpt = { id: string; name: string };
type EditDay = { date: string; facilityId: string; notes: string };

type EditStep = "form" | "preview";

type HistoryEntry = {
  id: string;
  editorName: string;
  editorLoginId: string;
  editedAtIso: string;
  snapshot: unknown;
};

export function ApplicationsAdminClient({
  month,
  userId,
  q,
  sortFacility,
  unsubmittedFirst,
  openMonth,
  rows,
  users,
  facilities,
}: {
  month: string;
  userId: string;
  q: string;
  sortFacility: string;
  unsubmittedFirst: boolean;
  openMonth: string;
  rows: Row[];
  users: User[];
  facilities: FacilityOpt[];
}) {
  const router = useRouter();
  const [year, monthIndex] = month.split("-").map(Number);
  const firstDow = new Date(year, monthIndex - 1, 1).getDay();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const [selectedOpenMonth, setSelectedOpenMonth] = useState(openMonth);
  const [busyMonth, setBusyMonth] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [editStep, setEditStep] = useState<EditStep>("form");
  const [editDays, setEditDays] = useState<EditDay[]>([]);
  const [selectedEditDate, setSelectedEditDate] = useState<string>("");
  const [editOverallNotes, setEditOverallNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [message, setMessage] = useState("");

  const [historyTarget, setHistoryTarget] = useState<{ userId: string; userName: string } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  function monthMinusOne(yyyyMm: string): string {
    const [y, m] = yyyyMm.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const [bulkDeleteMonth, setBulkDeleteMonth] = useState(() => monthMinusOne(month));
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<{
    month: string;
    applicationRowCount: number;
    userCount: number;
    editLogCount: number;
  } | null>(null);

  useEffect(() => {
    const lock = !!(editTarget || historyTarget);
    document.body.style.overflow = lock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [editTarget, historyTarget]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || savingEdit) return;
      if (historyTarget) {
        setHistoryTarget(null);
        setHistoryEntries(null);
        setHistoryError(null);
        return;
      }
      if (editTarget) {
        setEditTarget(null);
        setEditStep("form");
        setEditDays([]);
        setEditOverallNotes("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editTarget, historyTarget, savingEdit]);

  async function updateOpenMonth() {
    setBusyMonth(true);
    setMessage("");
    const res = await fetch("/api/admin/open-month", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openMonth: selectedOpenMonth }),
    });
    setBusyMonth(false);
    if (!res.ok) {
      setMessage("受付月の更新に失敗しました。");
      return;
    }
    setMessage(`受付月を ${selectedOpenMonth} に更新しました。`);
    router.refresh();
  }

  async function deleteUserMonth(targetUserId: string) {
    if (!confirm(`この利用者の ${month} 申請を削除します。よろしいですか？`)) return;
    setBusyUserId(targetUserId);
    setMessage("");
    const res = await fetch("/api/admin/applications/user-month", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, month }),
    });
    setBusyUserId(null);
    if (!res.ok) {
      setMessage("削除に失敗しました。");
      return;
    }
    setMessage("削除しました。対象利用者は同月を再申請できます。");
    router.refresh();
  }

  function facilityName(id: string) {
    return facilities.find((f) => f.id === id)?.name ?? id;
  }

  function startEdit(row: Row) {
    setMessage("");
    setEditTarget(row);
    setEditStep("form");
    setEditOverallNotes(row.overallNotesText ?? "");
    const initial =
      row.editableDays.length > 0
        ? row.editableDays.map((d) => ({ ...d }))
        : [{ date: `${month}-01`, facilityId: facilities[0]?.id ?? "", notes: "" }];
    setEditDays(initial);
    setSelectedEditDate(initial[0]?.date ?? `${month}-01`);
  }

  function cancelEdit() {
    setEditTarget(null);
    setEditStep("form");
    setEditDays([]);
    setSelectedEditDate("");
    setEditOverallNotes("");
  }

  function upsertEditDay(date: string, patch: Partial<EditDay>) {
    setEditDays((prev) => {
      const idx = prev.findIndex((d) => d.date === date);
      if (idx >= 0) {
        return prev.map((d, i) => (i === idx ? { ...d, ...patch } : d));
      }
      return [...prev, { date, facilityId: facilities[0]?.id ?? "", notes: "", ...patch }];
    });
  }

  function toggleEditDay(day: number) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    setEditDays((prev) => {
      const exists = prev.some((d) => d.date === date);
      if (exists) {
        const next = prev.filter((d) => d.date !== date);
        if (selectedEditDate === date) {
          setSelectedEditDate(next[0]?.date ?? "");
        }
        return next;
      }
      setSelectedEditDate(date);
      return [...prev, { date, facilityId: facilities[0]?.id ?? "", notes: "" }];
    });
  }

  function validateEdit(): string | null {
    if (editDays.length === 0) return "日付を1件以上入力してください。";
    const dup = new Set(editDays.map((d) => d.date));
    if (dup.size !== editDays.length) return "同じ日付が重複しています。";
    if (editDays.some((d) => !d.date.startsWith(`${month}-`))) return `日付は ${month} のみ指定できます。`;
    if (editDays.some((d) => !d.facilityId)) return "事業所を選択してください。";
    return null;
  }

  function goToPreview() {
    setMessage("");
    const err = validateEdit();
    if (err) {
      setMessage(err);
      return;
    }
    setEditStep("preview");
  }

  async function openHistory(targetUserId: string, userName: string) {
    setHistoryTarget({ userId: targetUserId, userName });
    setHistoryEntries(null);
    setHistoryError(null);
    setHistoryLoading(true);
    const res = await fetch(
      `/api/admin/applications/edit-history?targetUserId=${encodeURIComponent(targetUserId)}&month=${encodeURIComponent(month)}`
    );
    setHistoryLoading(false);
    if (!res.ok) {
      setHistoryError("履歴の取得に失敗しました。");
      return;
    }
    const j = (await res.json()) as { entries?: HistoryEntry[] };
    setHistoryEntries(j.entries ?? []);
  }

  function closeHistory() {
    setHistoryTarget(null);
    setHistoryEntries(null);
    setHistoryError(null);
  }

  async function fetchBulkPreview() {
    setMessage("");
    setBulkPreview(null);
    if (!/^\d{4}-\d{2}$/.test(bulkDeleteMonth)) {
      setMessage("一括削除の対象月を選んでください。");
      return;
    }
    setBulkBusy(true);
    const res = await fetch(
      `/api/admin/applications/bulk-delete-month?month=${encodeURIComponent(bulkDeleteMonth)}`
    );
    setBulkBusy(false);
    if (!res.ok) {
      setMessage("対象件数の取得に失敗しました。");
      return;
    }
    const j = (await res.json()) as {
      month: string;
      applicationRowCount: number;
      userCount: number;
      editLogCount: number;
    };
    setBulkPreview(j);
  }

  async function runBulkDelete() {
    setMessage("");
    if (!bulkPreview || bulkPreview.applicationRowCount === 0) {
      setMessage("先に「対象を確認」し、削除対象があることを確認してください。");
      return;
    }
    if (bulkDeleteMonth !== bulkPreview.month) {
      setMessage("対象月が変わっています。再度「対象を確認」してください。");
      return;
    }
    const warnOpen =
      bulkDeleteMonth === openMonth
        ? "\n\n注意: 選択した月は現在の申請受付月です。"
        : "";
    const ok = confirm(
      `${bulkDeleteMonth} の申請データを全利用者分削除します。\n\n` +
        `・申請行: ${bulkPreview.applicationRowCount} 件\n` +
        `・対象利用者: 約 ${bulkPreview.userCount} 名\n` +
        `・管理者編集履歴: ${bulkPreview.editLogCount} 件（同月分）\n` +
        `${warnOpen}\n\n` +
        `この操作は取り消せません。よろしいですか？`
    );
    if (!ok) return;

    setBulkBusy(true);
    const res = await fetch("/api/admin/applications/bulk-delete-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: bulkDeleteMonth }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      setMessage("一括削除に失敗しました。");
      return;
    }
    const j = (await res.json()) as { deletedApplicationRows?: number };
    setBulkPreview(null);
    setMessage(
      `${bulkDeleteMonth} の一括削除が完了しました（削除した申請行: ${j.deletedApplicationRows ?? 0} 件）。`
    );
    router.refresh();
  }

  async function commitSave(targetUserId: string) {
    const err = validateEdit();
    if (err) {
      setMessage(err);
      setEditStep("form");
      return;
    }

    setSavingEdit(true);
    const res = await fetch("/api/admin/applications/user-month", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId,
        month,
        days: [...editDays].sort((a, b) => a.date.localeCompare(b.date)),
        overallNotes: editOverallNotes,
      }),
    });
    setSavingEdit(false);
    if (!res.ok) {
      setMessage("更新に失敗しました。");
      return;
    }
    setMessage("申請内容を更新しました。");
    cancelEdit();
    router.refresh();
  }

  const sortedPreviewDays = [...editDays].sort((a, b) => a.date.localeCompare(b.date));
  const selectedEditDay = editDays.find((d) => d.date === selectedEditDate) ?? null;

  const csvHref =
    `/api/admin/applications/export?month=${encodeURIComponent(month)}` +
    (userId ? `&userId=${encodeURIComponent(userId)}` : "") +
    (q ? `&q=${encodeURIComponent(q)}` : "") +
    (sortFacility ? `&sortFacility=${encodeURIComponent(sortFacility)}` : "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-900">申請一覧</h1>
        <a
          href={csvHref}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 active:bg-slate-50"
        >
          CSV出力
        </a>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">申請受付月の管理</p>
        <p className="mt-1 text-xs text-slate-600">
          利用者はこの月のみ申請できます。申請後の内容調整は管理者がこの画面で対応します。
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="month"
            value={selectedOpenMonth}
            onChange={(e) => setSelectedOpenMonth(e.target.value)}
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-base"
          />
          <button
            type="button"
            onClick={updateOpenMonth}
            disabled={busyMonth}
            className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busyMonth ? "更新中..." : "受付月を更新"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm ring-1 ring-amber-100">
        <p className="text-sm font-semibold text-amber-950">過去月など・指定月の一括削除</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-950/90">
          受付が終わった月のデータをまとめて削除できます（例: 受付を5月にしたあと、4月分を一括削除）。
          選択した月について、<strong>全利用者</strong>の申請行を削除し、同じ月キーの管理者編集履歴も削除します。取り消しはできません。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-amber-950">
            削除する月
            <input
              type="month"
              value={bulkDeleteMonth}
              onChange={(e) => {
                setBulkDeleteMonth(e.target.value);
                setBulkPreview(null);
              }}
              className="mt-1 min-h-11 rounded-xl border border-amber-300 bg-white px-3 text-base"
            />
          </label>
          <button
            type="button"
            onClick={fetchBulkPreview}
            disabled={bulkBusy}
            className="mt-5 min-h-11 rounded-xl border border-amber-400 bg-white px-4 text-sm font-semibold text-amber-950 disabled:opacity-60"
          >
            {bulkBusy ? "確認中..." : "対象を確認"}
          </button>
        </div>
        {bulkPreview && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">{bulkPreview.month} の削除対象（予定）</p>
            <ul className="mt-2 list-inside list-disc text-xs text-slate-700">
              <li>申請データの行: {bulkPreview.applicationRowCount} 件</li>
              <li>対象利用者（目安）: {bulkPreview.userCount} 名</li>
              <li>管理者編集履歴: {bulkPreview.editLogCount} 件</li>
            </ul>
            {bulkPreview.applicationRowCount === 0 && (
              <p className="mt-2 text-xs text-slate-600">この月に該当するデータはありません。</p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={runBulkDelete}
          disabled={bulkBusy || !bulkPreview || bulkPreview.applicationRowCount === 0}
          className="mt-3 min-h-11 w-full rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          {bulkBusy ? "処理中..." : "この月を一括削除する"}
        </button>
      </div>

      <form className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200" method="get">
        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm font-medium text-slate-700">
            月
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            利用者（プルダウン）
            <select
              name="userId"
              defaultValue={userId}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
            >
              <option value="">全員</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.loginId})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            名前・ログインIDで検索
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="例: 山田 / demo"
              list="admin-user-search-hints"
              autoComplete="off"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
            />
            <datalist id="admin-user-search-hints">
              {users.map((u) => (
                <option key={u.id} value={`${u.name} (${u.loginId})`} />
              ))}
            </datalist>
          </label>
          <label className="text-sm font-medium text-slate-700">
            並び替え（事業所の利用日数が多い順）
            <select
              name="sortFacility"
              defaultValue={sortFacility}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base"
            >
              <option value="">指定なし（ログインID順）</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="unsubmittedFirst"
              value="1"
              defaultChecked={unsubmittedFirst}
              className="h-5 w-5 rounded border-slate-300"
            />
            未申請の人を先頭に表示
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          並び替えを選ぶと、その事業所の日数が多い利用者が上に来ます。各行ではその利用者の全事業所の利用日数を表示します。
        </p>
        <button
          type="submit"
          className="mt-3 min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          絞り込み / 適用
        </button>
      </form>

      {message && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{message}</p>}

      <div className="text-sm text-slate-600">
        {month} の利用者件数: {rows.length}件
      </div>

      <div className="flex flex-col gap-2">
        {rows.length === 0 && (
          <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            該当データがありません。
          </div>
        )}
        {rows.map((r) => (
          <div key={r.userId} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">
                {r.userName} ({r.loginId})
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openHistory(r.userId, r.userName)}
                  disabled={busyUserId === r.userId || savingEdit}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                >
                  変更履歴
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(r)}
                  disabled={busyUserId === r.userId || savingEdit}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 disabled:opacity-60"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => deleteUserMonth(r.userId)}
                  disabled={busyUserId === r.userId || savingEdit}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 disabled:opacity-60"
                >
                  {busyUserId === r.userId ? "削除中..." : `${month}申請を削除`}
                </button>
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-600">申請日時: {r.submittedAtText}</div>
            <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">
              <span className="font-medium text-slate-600">事業所別利用日数: </span>
              {r.facilityCountsList.length > 0
                ? r.facilityCountsList.map(({ name, days }) => (
                    <span key={name} className="mr-2 inline-block">
                      <span className={sortFacility === name ? "font-bold text-blue-800" : ""}>
                        {name} {days}日
                      </span>
                    </span>
                  ))
                : "—"}
            </div>
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                  <div key={`pad-${r.userId}-${i}`} className="min-h-[3.75rem] rounded-md bg-transparent" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const names = r.dayFacilities[day] ?? [];
                  const has = names.length > 0;
                  return (
                    <div
                      key={`${r.userId}-d-${day}`}
                      className={`min-h-[3.75rem] rounded-md border p-1 ${
                        has ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className={`text-xs font-bold ${has ? "text-slate-900" : "text-slate-400"}`}>{day}</div>
                      <div className={`mt-0.5 line-clamp-3 text-[10px] leading-tight ${has ? "text-blue-900" : "text-slate-400"}`}>
                        {has ? names.join(" / ") : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-xs text-slate-700">
              全体連絡事項: {r.overallNotes.join(" / ") || "なし"}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
              日別連絡事項: {r.dailyNotes.join(" / ") || "なし"}
            </div>
          </div>
        ))}
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="閉じる"
            disabled={savingEdit}
            onClick={() => !savingEdit && cancelEdit()}
          />
          <div
            className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 id="edit-modal-title" className="text-base font-bold text-slate-900">
                  {editStep === "form" ? "申請内容の編集" : "保存前の確認"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  {editTarget.userName}（{editTarget.loginId}）・{month}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !savingEdit && cancelEdit()}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {editStep === "form" ? (
                <>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                    全体連絡事項
                    <textarea
                      value={editOverallNotes}
                      onChange={(e) => setEditOverallNotes(e.target.value)}
                      className="min-h-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <p className="mt-3 text-xs text-slate-600">
                    カレンダーの日付をクリックすると選択/解除できます。選択した日付を下で1日ずつ編集します。
                  </p>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-7 gap-1">
                      {WEEKDAYS.map((w, idx) => (
                        <div
                          key={`edit-w-${w}`}
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
                        <div key={`edit-pad-${i}`} className="min-h-[3.25rem] rounded-md bg-transparent" />
                      ))}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const date = `${month}-${String(day).padStart(2, "0")}`;
                        const isSelected = editDays.some((d) => d.date === date);
                        const isActive = selectedEditDate === date;
                        return (
                          <button
                            key={`edit-day-${day}`}
                            type="button"
                            onClick={() => {
                              if (isSelected && !isActive) {
                                setSelectedEditDate(date);
                                return;
                              }
                              toggleEditDay(day);
                            }}
                            className={`min-h-[3.25rem] rounded-md border p-1 text-left ${
                              isActive
                                ? "border-blue-600 bg-blue-100"
                                : isSelected
                                  ? "border-blue-300 bg-blue-50"
                                  : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className={`text-xs font-bold ${isSelected ? "text-slate-900" : "text-slate-400"}`}>{day}</div>
                            <div className="mt-0.5 text-[10px] text-slate-600">{isSelected ? "選択中" : "—"}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {selectedEditDay ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-sm font-semibold text-slate-900">{selectedEditDay.date}</p>
                      <label className="mt-2 flex flex-col gap-1 text-xs font-medium text-slate-700">
                        事業所
                        <select
                          value={selectedEditDay.facilityId}
                          onChange={(e) => upsertEditDay(selectedEditDay.date, { facilityId: e.target.value })}
                          className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-2 text-sm"
                        >
                          {facilities.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-2 flex flex-col gap-1 text-xs font-medium text-slate-700">
                        日別連絡事項
                        <textarea
                          value={selectedEditDay.notes}
                          onChange={(e) => upsertEditDay(selectedEditDay.date, { notes: e.target.value })}
                          className="min-h-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-600">編集する日付をカレンダーから選択してください。</p>
                  )}
                </>
              ) : (
                <div className="space-y-3 text-sm text-slate-800">
                  <p className="text-xs text-slate-600">以下の内容でデータベースに保存します。問題なければ「この内容で保存」を押してください。</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-600">全体連絡事項</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {editOverallNotes.trim() ? editOverallNotes.trim() : "（なし）"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold text-slate-600">日別</p>
                    <ul className="mt-2 space-y-2">
                      {sortedPreviewDays.map((d) => (
                        <li key={d.date} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-sm">
                          <span className="font-semibold text-slate-900">{d.date}</span>
                          <span className="text-slate-600"> ・ {facilityName(d.facilityId)}</span>
                          {d.notes.trim() ? (
                            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{d.notes.trim()}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">
              {editStep === "form" ? (
                <>
                  <button
                    type="button"
                    onClick={goToPreview}
                    disabled={savingEdit}
                    className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:flex-none"
                  >
                    内容を確認
                  </button>
                  <button
                    type="button"
                    onClick={() => !savingEdit && cancelEdit()}
                    disabled={savingEdit}
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
                  >
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => !savingEdit && setEditStep("form")}
                    disabled={savingEdit}
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
                  >
                    戻る
                  </button>
                  <button
                    type="button"
                    onClick={() => editTarget && commitSave(editTarget.userId)}
                    disabled={savingEdit}
                    className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:flex-none"
                  >
                    {savingEdit ? "保存中..." : "この内容で保存"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {historyTarget && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="閉じる"
            onClick={closeHistory}
          />
          <div
            className="relative z-10 flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 id="history-modal-title" className="text-base font-bold text-slate-900">
                  変更履歴
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  {historyTarget.userName}・{month}
                </p>
              </div>
              <button
                type="button"
                onClick={closeHistory}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {historyLoading && <p className="text-sm text-slate-600">読み込み中…</p>}
              {historyError && <p className="text-sm text-rose-700">{historyError}</p>}
              {!historyLoading && !historyError && historyEntries && historyEntries.length === 0 && (
                <p className="text-sm text-slate-600">まだ管理者による編集履歴はありません。</p>
              )}
              {!historyLoading && !historyError && historyEntries && historyEntries.length > 0 && (
                <ul className="space-y-3">
                  {historyEntries.map((e) => (
                    <li key={e.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-semibold text-slate-900">
                        {new Date(e.editedAtIso).toLocaleString("ja-JP", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="mt-1 text-xs text-slate-700">
                        {e.editorName}（{e.editorLoginId}）
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-blue-800">保存内容（JSON）</summary>
                        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white p-2 text-[11px] leading-snug text-slate-800 ring-1 ring-slate-200">
                          {JSON.stringify(e.snapshot, null, 2)}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={closeHistory}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
