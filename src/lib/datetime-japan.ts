/**
 * 画面表示用: DB の UTC 日時を問わず、常に日本時間で `yyyy-MM-dd HH:mm` にする。
 */
export function formatDateTimeJapan(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
