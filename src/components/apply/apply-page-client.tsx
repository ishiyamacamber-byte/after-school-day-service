"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatDateTimeJapan,
  formatDateYmdJapan,
  formatMonthDayWeekdayJapanYmd,
  formatWeekdayShortJapan,
  formatYmdFromCalendarGrid,
  getDayOfWeekSun0JapanYmd,
  parseYmdAsTokyoNoon,
} from "@/lib/datetime-japan";
import { getDefaultFacilityIdForDate } from "@/lib/default-schedule";
import { SubmittedCalendar } from "@/components/apply/submitted-calendar";

type Facility = { id: string; name: string };

type SubmissionSummary = {
  days: Record<string, { facilityName: string; notes: string | null }>;
  overallNotes: string | null;
};

type UserAdminEditHistoryItem = {
  id: string;
  editedAtText: string;
  editorName: string;
  editorLoginId: string;
  overallNotes: string | null;
  dayRows: { date: string; facilityName: string; notes: string }[];
};

type UserPayload = {
  id: string;
  defaultSchedule: string;
  monthlyLimit: number;
  openMonth: string;
  alreadySubmitted: boolean;
  submittedAtText: string | null;
  submissionSummary: SubmissionSummary | null;
  summariesByMonth: Record<string, SubmissionSummary>;
  submittedMonths: string[];
  adminEditHistoryByMonth: Record<string, UserAdminEditHistoryItem[]>;
};

type DayEntry = {
  facilityId: string;
  notes: string;
};

function dateKey(d: Date) {
  return formatDateYmdJapan(d);
}

const WEEKDAY_SHORT = ["日", "月", "火", "水", "木", "金", "土"] as const;

function monthLabelJa(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${y}年${m}月`;
}

export function ApplyPageClient({
  user,
  facilities,
}: {
  user: UserPayload;
  facilities: Facility[];
}) {
  const router = useRouter();
  const [oy, om] = user.openMonth.split("-").map(Number);
  const openMonthDate = new Date(oy, om - 1, 1);
  const openMonthStart = new Date(oy, om - 1, 1);
  const openMonthEnd = new Date(oy, om, 0);
  const [submittedAtText, setSubmittedAtText] = useState<string | null>(user.submittedAtText);
  const [submittedNow, setSubmittedNow] = useState(user.alreadySubmitted);
  const [activeMonth, setActiveMonth] = useState(user.openMonth);
  const hasSubmittedOpenMonth = submittedNow;

  const selectableMonths = useMemo(() => {
    const months = [...user.submittedMonths];
    if (!hasSubmittedOpenMonth && !months.includes(user.openMonth)) {
      months.push(user.openMonth);
    }
    return months.sort();
  }, [user.submittedMonths, user.openMonth, hasSubmittedOpenMonth]);

  const isViewingOpenMonth = activeMonth === user.openMonth;
  const showRegisteredView = user.summariesByMonth[activeMonth] != null;
  const showApplyForm = isViewingOpenMonth && !hasSubmittedOpenMonth;
  const displaySummary = user.summariesByMonth[activeMonth] ?? null;
  const adminEditHistory = user.adminEditHistoryByMonth[activeMonth] ?? [];

  useEffect(() => {
    setSubmittedAtText(user.submittedAtText);
    setSubmittedNow(user.alreadySubmitted);
  }, [user.submittedAtText, user.alreadySubmitted]);

  useEffect(() => {
    setActiveMonth(user.openMonth);
  }, [user.openMonth]);

  const hasFacilities = facilities.length > 0;
  const [month] = useState(() => openMonthDate);
  const [selected, setSelected] = useState<Date[]>([]);
  const [byDate, setByDate] = useState<Record<string, DayEntry>>({});
  const [overallNotes, setOverallNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedInMonthCount = useMemo(() => {
    const y = openMonthDate.getFullYear();
    const m = openMonthDate.getMonth();
    return selected.filter((d) => d.getFullYear() === y && d.getMonth() === m).length;
  }, [selected, openMonthDate]);

  const overLimit = selectedInMonthCount > user.monthlyLimit;

  function ensureEntry(d: Date): DayEntry {
    const key = dateKey(d);
    const existing = byDate[key];
    if (existing) return existing;
    const def = getDefaultFacilityIdForDate(user.defaultSchedule, d);
    const firstFacility = facilities[0]?.id ?? "";
    return {
      facilityId: def && facilities.some((f) => f.id === def) ? def : firstFacility,
      notes: "",
    };
  }

  function patchDate(d: Date, patch: Partial<DayEntry>) {
    const key = dateKey(d);
    setByDate((prev) => ({
      ...prev,
      [key]: { ...ensureEntry(d), ...patch },
    }));
  }

  function onSelectMulti(dates: Date[] | undefined) {
    const next = dates ?? [];
    setSelected(next);
    setByDate((prev) => {
      const n = { ...prev };
      for (const d of next) {
        const key = dateKey(d);
        if (!n[key]) {
          const def = getDefaultFacilityIdForDate(user.defaultSchedule, d);
          const firstFacility = facilities[0]?.id ?? "";
          n[key] = {
            facilityId: def && facilities.some((f) => f.id === def) ? def : firstFacility,
            notes: "",
          };
        }
      }
      return n;
    });
  }

  function toggleDate(d: Date) {
    const key = dateKey(d);
    const exists = selected.some((x) => dateKey(x) === key);
    if (exists) {
      onSelectMulti(selected.filter((x) => dateKey(x) !== key));
      return;
    }
    onSelectMulti([...selected, d]);
  }

  function datesInOpenMonthForWeekday(weekday: number): Date[] {
    const out: Date[] = [];
    const lastDay = openMonthEnd.getDate();
    for (let day = 1; day <= lastDay; day++) {
      const key = formatYmdFromCalendarGrid(oy, om - 1, day);
      if (getDayOfWeekSun0JapanYmd(key) === weekday) out.push(parseYmdAsTokyoNoon(key));
    }
    return out;
  }

  function selectAllForWeekday(weekday: number) {
    const add = datesInOpenMonthForWeekday(weekday);
    if (add.length === 0) return;
    const map = new Map<string, Date>();
    for (const d of selected) map.set(dateKey(d), d);
    for (const d of add) map.set(dateKey(d), d);
    onSelectMulti([...map.values()]);
  }

  async function onSubmit() {
    setMessage(null);
    if (!hasFacilities) {
      setMessage("利用可能な事業所が設定されていません。管理者にお問い合わせください。");
      return;
    }
    if (selected.length === 0) {
      setMessage("日付を1日以上選択してください。");
      return;
    }
    setSubmitting(true);
    const days = [...selected]
      .sort((a, b) => a.getTime() - b.getTime())
      .map((d) => {
        const key = dateKey(d);
        const e = byDate[key] ?? ensureEntry(d);
        return {
          date: key,
          facilityId: e.facilityId,
          notes: e.notes,
        };
      });

    const res = await fetch("/api/applications/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        days,
        overallNotes: overallNotes.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMessage(`送信に失敗しました。${j.error ? ` (${j.error})` : ""}`);
      return;
    }
    setMessage("申請を受け付けました。");
    setSubmittedAtText(formatDateTimeJapan(new Date()));
    setSubmittedNow(true);
    setSelected([]);
    setByDate({});
    router.refresh();
  }

  const sortedSelected = [...selected].sort((a, b) => a.getTime() - b.getTime());
  const firstDow = getDayOfWeekSun0JapanYmd(formatYmdFromCalendarGrid(oy, om - 1, 1));
  const daysInMonth = openMonthEnd.getDate();

  function facilityLabelForDate(d: Date): string {
    const key = dateKey(d);
    const selectedEntry = byDate[key];
    if (selectedEntry) {
      return facilities.find((f) => f.id === selectedEntry.facilityId)?.name ?? "";
    }
    const defaultFacilityId = getDefaultFacilityIdForDate(user.defaultSchedule, d);
    if (!defaultFacilityId) return "";
    return facilities.find((f) => f.id === defaultFacilityId)?.name ?? "";
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">利用予定の申請</h1>
        <p className="mt-1 text-sm text-slate-600">
          申請受付月: {user.openMonth}（この月のみ選択可能）
        </p>
      </div>

      {selectableMonths.length > 1 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <label className="text-sm font-medium text-slate-700">
            表示する月
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base font-semibold text-slate-900"
            >
              {selectableMonths.map((m) => {
                const isOpen = m === user.openMonth;
                const isSubmitted = user.submittedMonths.includes(m);
                let suffix = "";
                if (isOpen && !isSubmitted) suffix = "（申請する月）";
                else if (isOpen && isSubmitted) suffix = "（申請済み）";
                else if (isSubmitted) suffix = "（登録済み）";
                return (
                  <option key={m} value={m}>
                    {monthLabelJa(m)}（{m}）{suffix}
                  </option>
                );
              })}
            </select>
          </label>
          <p className="mt-2 text-xs text-slate-600">
            {showApplyForm
              ? `${monthLabelJa(activeMonth)}の利用予定を申請できます。`
              : `${monthLabelJa(activeMonth)}に登録されている利用予定を表示しています。`}
          </p>
        </div>
      ) : null}

      {hasSubmittedOpenMonth && isViewingOpenMonth ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p className="font-semibold">{user.openMonth} の申請は完了しています。</p>
          <p className="mt-1">最終更新（登録反映）: {submittedAtText ?? "不明"}</p>
          <p className="mt-2 text-xs leading-relaxed">
            下記は<strong>いまシステムに登録されている内容</strong>です。管理者が修正した場合も、ここに反映された状態で表示されます。内容の変更は管理者にご相談ください。
          </p>
        </div>
      ) : null}

      {showRegisteredView && displaySummary ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {monthLabelJa(activeMonth)}の登録済み利用予定
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              ご自身が送信した申請に加え、管理者が調整した結果が含まれます。
            </p>
          </div>

          <SubmittedCalendar
            year={Number(activeMonth.split("-")[0])}
            monthIndex={Number(activeMonth.split("-")[1]) - 1}
            dayMap={Object.fromEntries(
              Object.entries(displaySummary.days).map(([k, v]) => [
                k,
                { facilityName: v.facilityName, notes: v.notes },
              ])
            )}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
            <h3 className="text-base font-bold text-slate-900">連絡事項（登録内容）</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-bold text-slate-600">全体</p>
                <p className="mt-2 min-h-[1.25rem] whitespace-pre-wrap text-base leading-relaxed text-slate-900">
                  {displaySummary.overallNotes?.trim() ? displaySummary.overallNotes : (
                    <span className="text-slate-400">なし</span>
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-bold text-slate-600">日ごと</p>
                <ul className="mt-2 space-y-3">
                  {Object.entries(displaySummary.days)
                    .filter(([, v]) => v.notes?.trim())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, v]) => (
                      <li
                        key={key}
                        className="rounded-lg border border-slate-200 bg-white p-3 text-base leading-relaxed text-slate-900 shadow-sm"
                      >
                        <span className="block text-sm font-bold text-slate-700">
                          {formatMonthDayWeekdayJapanYmd(key)}
                        </span>
                        <span className="mt-1 block whitespace-pre-wrap">{v.notes}</span>
                      </li>
                    ))}
                </ul>
                {!Object.values(displaySummary.days).some((v) => v.notes?.trim()) && (
                  <p className="mt-2 text-base text-slate-400">なし</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 shadow-sm ring-1 ring-indigo-100 sm:p-5">
            <h3 className="text-base font-bold text-slate-900">管理者による変更履歴</h3>
            <p className="mt-1 text-xs text-slate-600">
              管理者が申請内容を修正・保存したときの記録です。各回の内容は、その時点で保存されたスナップショットです。
            </p>
            {adminEditHistory.length === 0 ? (
              <p className="mt-3 text-sm text-slate-700">
                まだ管理者による変更はありません（ご自身の申請の直後、または管理者が未対応の場合）。
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {adminEditHistory.map((h, idx) => (
                  <li
                    key={h.id}
                    className="rounded-xl border border-indigo-100 bg-white p-3 text-sm text-slate-800 shadow-sm"
                  >
                    <p className="font-semibold text-slate-900">
                      {idx + 1}回目 · {h.editedAtText}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      対応者: {h.editorName}（{h.editorLoginId}）
                    </p>
                    <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs">
                      <p className="font-bold text-slate-600">全体連絡事項</p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-800">
                        {h.overallNotes?.trim() ? h.overallNotes : "なし"}
                      </p>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-bold text-slate-600">日別</p>
                      <ul className="mt-1 space-y-1.5">
                        {h.dayRows.map((d) => (
                          <li
                            key={`${h.id}-${d.date}`}
                            className="rounded-md border border-slate-100 bg-white px-2 py-1.5 text-xs leading-snug"
                          >
                            <span className="font-semibold text-slate-800">
                              {formatMonthDayWeekdayJapanYmd(d.date)}
                            </span>
                            <span className="text-slate-600"> · {d.facilityName}</span>
                            {d.notes.trim() ? (
                              <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{d.notes}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {showApplyForm && overLimit && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          今月の選択は {selectedInMonthCount} 日で、上限（{user.monthlyLimit}
          日）を超えています。このまま申請できますが、内容をご確認ください。
        </div>
      )}

      {showApplyForm && !hasFacilities && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          利用可能な事業所が設定されていないため申請できません。管理者が利用者設定を確認してください。
        </div>
      )}
      {showApplyForm && (
        <>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {monthLabelJa(user.openMonth)}の利用予定を申請
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              カレンダーで日付を選び、内容を入力して送信してください。
            </p>
          </div>
          <div className="apply-calendar overflow-x-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3">
              <p className="text-xs font-medium text-slate-600">曜日を一括選択</p>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {WEEKDAY_SHORT.map((w, idx) => (
                  <button
                    key={`weekday-bulk-${w}`}
                    type="button"
                    onClick={() => selectAllForWeekday(idx)}
                    className={`min-h-9 rounded-lg border text-xs font-semibold ${
                      idx === 0
                        ? "border-red-200 bg-red-50 text-red-700"
                        : idx === 6
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full min-w-[20rem] sm:min-w-[36rem]">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {WEEKDAY_SHORT.map((w, idx) => (
                  <div
                    key={`apply-weekday-${w}`}
                    className={`rounded-lg py-1.5 text-center text-[11px] font-bold sm:text-xs ${
                      idx === 0 ? "bg-red-50 text-red-700" : idx === 6 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
                {Array.from({ length: firstDow }, (_, i) => (
                  <div key={`apply-pad-${i}`} className="min-h-[5rem] rounded-2xl border border-transparent bg-slate-50/30" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const key = formatYmdFromCalendarGrid(oy, om - 1, day);
                  const d = parseYmdAsTokyoNoon(key);
                  const isSelected = selected.some((x) => dateKey(x) === key);
                  const label = facilityLabelForDate(d);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleDate(d)}
                      className={`flex min-h-[5rem] flex-col rounded-2xl border-2 p-2 text-left sm:min-h-[5.5rem] sm:p-2.5 ${
                        isSelected
                          ? "border-blue-400 bg-gradient-to-b from-blue-50 to-white shadow-sm"
                          : "border-slate-100 bg-slate-50/90"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 border-b border-slate-200/80 pb-1">
                        <span
                          className={`text-base font-bold leading-none tabular-nums sm:text-lg ${
                            isSelected ? "text-slate-900" : "text-slate-500"
                          }`}
                        >
                          {day}
                        </span>
                        <span className="text-[11px] text-slate-500 sm:text-xs">
                          {formatWeekdayShortJapan(d)}
                        </span>
                      </div>
                      <p
                        className={`mt-1.5 line-clamp-4 text-left text-[11px] leading-snug sm:text-xs ${
                          label
                            ? isSelected
                              ? "font-bold text-blue-950"
                              : "text-slate-700"
                            : "text-transparent"
                        }`}
                      >
                        {label || "　"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-semibold text-slate-900">申請全体（任意）</h2>
            <p className="mt-1 text-xs text-slate-600">連絡事項を日ごとではなくまとめて入力する場合に使用します。</p>
            <label className="mt-3 flex flex-col gap-2 text-sm font-medium text-slate-800">
              連絡事項・特記事項（全体）
              <textarea
                className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-base"
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                placeholder="全体に関する連絡があれば入力"
              />
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-slate-900">選択した日付</h2>
            {sortedSelected.length === 0 && (
              <p className="text-sm text-slate-600">上のカレンダーで日付を選択してください。</p>
            )}
            {sortedSelected.map((d) => {
              const key = dateKey(d);
              const e = byDate[key] ?? ensureEntry(d);
              return (
                <div key={key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="font-semibold text-slate-900">
                    {formatMonthDayWeekdayJapanYmd(dateKey(d))}
                  </div>
                  <label className="mt-3 flex flex-col gap-2 text-sm font-medium text-slate-700">
                    利用事業所
                    <select
                      className="min-h-12 rounded-xl border border-slate-300 px-3 text-base"
                      value={e.facilityId}
                      onChange={(ev) => patchDate(d, { facilityId: ev.target.value })}
                    >
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 flex flex-col gap-2 text-sm font-medium text-slate-800">
                    連絡事項・特記事項（この日）
                    <textarea
                      className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-base"
                      value={e.notes}
                      onChange={(ev) => patchDate(d, { notes: ev.target.value })}
                    />
                  </label>
                </div>
              );
            })}
          </section>

        </>
      )}

      {message && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800" role="status">
          {message}
        </p>
      )}

      {showApplyForm && (
        <button
          type="button"
          disabled={submitting || selected.length === 0 || !hasFacilities}
          onClick={onSubmit}
          className="min-h-14 rounded-xl bg-blue-600 text-base font-semibold text-white shadow active:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "送信中…" : "申請を送信"}
        </button>
      )}
    </div>
  );
}
