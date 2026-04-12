import { format } from "date-fns";
import { ja } from "date-fns/locale";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type DayInfo = { facilityName: string; notes: string | null };

export function SubmittedCalendar({
  year,
  monthIndex,
  dayMap,
}: {
  year: number;
  monthIndex: number;
  dayMap: Record<string, DayInfo>;
}) {
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const listItems = Object.entries(dayMap)
    .filter(([, v]) => v.facilityName)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const d = new Date(`${key}T12:00:00`);
      return {
        key,
        label: format(d, "M月d日（E）", { locale: ja }),
        facility: v.facilityName,
        hasNotes: !!v.notes?.trim(),
      };
    });

  const pad = Array.from({ length: firstDow }, (_, i) => (
    <div
      key={`pad-${i}`}
      className="min-h-[5rem] min-w-[2.75rem] rounded-2xl border border-transparent bg-slate-50/30 sm:min-h-[5.5rem] sm:min-w-[3rem]"
    />
  ));

  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const d = new Date(year, monthIndex, day);
    const key = format(d, "yyyy-MM-dd");
    const info = dayMap[key];
    const has = !!info?.facilityName;
    const dow = d.getDay();
    const isSun = dow === 0;
    const isSat = dow === 6;

    return (
      <div
        key={key}
        className={`flex min-h-[5rem] min-w-[2.75rem] flex-col rounded-2xl border-2 p-2 sm:min-h-[5.5rem] sm:min-w-[3rem] sm:p-2.5 ${
          has
            ? "border-blue-400 bg-gradient-to-b from-blue-50 to-white shadow-sm"
            : "border-slate-100 bg-slate-50/90"
        }`}
      >
        <div className="flex items-center justify-between gap-1 border-b border-slate-200/80 pb-1">
          <span
            className={`text-base font-bold tabular-nums leading-none sm:text-lg ${
              has ? "text-slate-900" : "text-slate-400"
            } ${isSun ? "text-red-600" : ""} ${isSat ? "text-blue-700" : ""}`}
          >
            {day}
          </span>
          <span
            className={`text-[11px] font-medium leading-none sm:text-xs ${
              isSun ? "text-red-500" : isSat ? "text-blue-600" : "text-slate-500"
            }`}
          >
            {format(d, "E", { locale: ja })}
          </span>
        </div>
        {has ? (
          <p className="mt-1.5 line-clamp-4 text-left text-[11px] font-bold leading-snug text-blue-950 sm:text-xs">
            {info!.facilityName}
          </p>
        ) : (
          <p className="mt-1.5 text-center text-[10px] text-slate-400">—</p>
        )}
      </div>
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <p className="text-base font-bold text-slate-900">
            {year}年{monthIndex + 1}月のスケジュール
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border-2 border-blue-400 bg-blue-50" aria-hidden />
              申請あり
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-slate-200 bg-slate-50" aria-hidden />
              なし
            </span>
          </div>
        </div>

        <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          <div className="w-full min-w-[20rem] sm:min-w-[36rem]">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {WEEKDAYS.map((w, idx) => (
                <div
                  key={w}
                  className={`rounded-lg py-2 text-center text-xs font-bold sm:text-sm ${
                    idx === 0 ? "bg-red-50 text-red-700" : idx === 6 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
              {pad}
              {cells}
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500 sm:hidden sm:text-xs">
          画面が狭いときは横にスクロールして全体を表示できます
        </p>
      </div>

      {listItems.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <h3 className="text-sm font-bold text-slate-900">申請した日（一覧）</h3>
          <p className="mt-1 text-xs text-slate-500">日付順に並べています。タップしやすいよう一覧でも確認できます。</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {listItems.map((item) => (
              <li key={item.key} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <span className="text-base font-bold text-slate-900">{item.label}</span>
                  {item.hasNotes && (
                    <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                      連絡あり
                    </span>
                  )}
                </div>
                <div className="shrink-0 rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-950 ring-1 ring-blue-100">
                  {item.facility}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
