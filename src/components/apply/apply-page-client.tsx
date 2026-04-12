"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { ja } from "date-fns/locale";
import { format } from "date-fns";
import "react-day-picker/style.css";
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
  adminEditHistory: UserAdminEditHistoryItem[];
};

type DayEntry = {
  facilityId: string;
  notes: string;
};

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
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
  const hasSubmitted = submittedAtText !== null || user.alreadySubmitted;
  const displaySummary = user.submissionSummary;

  useEffect(() => {
    setSubmittedAtText(user.submittedAtText);
  }, [user.submittedAtText]);

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
    setSubmittedAtText(format(new Date(), "yyyy-MM-dd HH:mm"));
    setSelected([]);
    setByDate({});
    router.refresh();
  }

  const sortedSelected = [...selected].sort((a, b) => a.getTime() - b.getTime());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">利用予定の申請</h1>
        <p className="mt-1 text-sm text-slate-600">
          申請受付月: {user.openMonth}（この月のみ選択可能）
        </p>
      </div>

      {hasSubmitted ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
            <p className="font-semibold">この月の申請は完了しています。</p>
            <p className="mt-1">最終更新（登録反映）: {submittedAtText ?? "不明"}</p>
            <p className="mt-2 text-xs leading-relaxed">
              下記は<strong>いまシステムに登録されている内容</strong>です。管理者が修正した場合も、ここに反映された状態で表示されます。内容の変更は管理者にご相談ください。
            </p>
          </div>

          {displaySummary && (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-900">いま登録されている利用予定</h2>
                <p className="mt-1 text-xs text-slate-600">
                  ご自身が送信した申請に加え、管理者が調整した結果が含まれます。
                </p>
              </div>
              <SubmittedCalendar
                year={oy}
                monthIndex={om - 1}
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
                              {format(new Date(`${key}T12:00:00`), "M月d日（E）", { locale: ja })}
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
                {user.adminEditHistory.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-700">
                    まだ管理者による変更はありません（ご自身の申請の直後、または管理者が未対応の場合）。
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {user.adminEditHistory.map((h, idx) => (
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
                                  {format(new Date(`${d.date}T12:00:00`), "M月d日（E）", { locale: ja })}
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
            </>
          )}
        </div>
      ) : null}

      {!hasSubmitted && overLimit && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          今月の選択は {selectedInMonthCount} 日で、上限（{user.monthlyLimit}
          日）を超えています。このまま申請できますが、内容をご確認ください。
        </div>
      )}

      {!hasSubmitted && !hasFacilities && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          利用可能な事業所が設定されていないため申請できません。管理者が利用者設定を確認してください。
        </div>
      )}
      {!hasSubmitted && (
        <>
          <div className="apply-calendar overflow-x-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <DayPicker
              mode="multiple"
              locale={ja}
              month={month}
              startMonth={openMonthDate}
              endMonth={openMonthDate}
              hidden={[{ before: openMonthStart }, { after: openMonthEnd }]}
              selected={selected}
              onSelect={onSelectMulti}
              className="mx-auto"
            />
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
                  <div className="font-semibold text-slate-900">{format(d, "M月d日（E）", { locale: ja })}</div>
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

      {!hasSubmitted && (
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
