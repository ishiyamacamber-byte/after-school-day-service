import { formatDateYmdJapan, getDayOfWeekSun0JapanYmd } from "./datetime-japan";

/** default_schedule JSON: キーは曜日（0=日〜6=土）。日本の暦に合わせる（利用者の端末TZに依存しない）。 */
export function getDefaultFacilityIdForDate(
  defaultScheduleJson: string,
  date: Date
): string | undefined {
  try {
    const map = JSON.parse(defaultScheduleJson) as Record<string, string>;
    const ymd = formatDateYmdJapan(date);
    const dow = getDayOfWeekSun0JapanYmd(ymd);
    return map[String(dow)];
  } catch {
    return undefined;
  }
}
