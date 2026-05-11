const TOKYO: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo" };

/**
 * 画面表示用: DB の UTC 日時を問わず、常に日本時間で `yyyy-MM-dd HH:mm` にする。
 * `en-CA` + formatToParts は一部の Node/ICU で timeZone が効かず UTC 表示になることがあるため、
 * `sv-SE` + toLocaleString で組み立てる。
 */
export function formatDateTimeJapan(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const s = d.toLocaleString("sv-SE", {
    ...TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const normalized = s.replace(",", "").replace("T", " ").trim();
  const spaceIdx = normalized.indexOf(" ");
  if (spaceIdx === -1) return normalized;
  const datePart = normalized.slice(0, spaceIdx);
  const timeHead = normalized.slice(spaceIdx + 1, spaceIdx + 6);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart) && /^\d{2}:\d{2}$/.test(timeHead)) {
    return `${datePart} ${timeHead}`;
  }
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/.exec(normalized);
  return m ? `${m[1]} ${m[2]}` : normalized;
}

/**
 * 瞬間を日本の暦の `yyyy-MM-dd` にする（日付キー・CSV・集計の揃え用）。
 */
export function formatDateYmdJapan(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("sv-SE", TOKYO);
}

/** `yyyy-MM-dd` を日本のその日の正午（+09:00）として解釈（暦がずれないようにする） */
export function parseYmdAsTokyoNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+09:00`);
}

/**
 * `yyyy-MM-dd` → 表示用 `5月11日（月）`（日本時間の暦・曜日）
 */
export function formatMonthDayWeekdayJapanYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const d = parseYmdAsTokyoNoon(ymd);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}月${get("day")}日（${get("weekday")}）`;
}

/** カレンダー枠の曜日略称（日本時間の暦） */
export function formatWeekdayShortJapan(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).formatToParts(d);
  return parts.find((p) => p.type === "weekday")?.value ?? "";
}

/** `yyyy-MM-dd`（日本の利用日）の曜日 0=日 … 6=土（クライアントのローカルTZに依存しない） */
export function getDayOfWeekSun0JapanYmd(ymd: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 0;
  const [y, m, d] = ymd.split("-").map(Number);
  // その日の JST 12:00 は UTC では同日 03:00（日本では日付が変わらない）
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0)).getUTCDay();
}

/** 画面で表示している「受付月」の年・0始まり月・日 → 利用日キー */
export function formatYmdFromCalendarGrid(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
