/** default_schedule JSON: キーは JS の getDay()（0=日〜6=土）に対応する文字列。値は Facility の id。 */
export function getDefaultFacilityIdForDate(
  defaultScheduleJson: string,
  date: Date
): string | undefined {
  try {
    const map = JSON.parse(defaultScheduleJson) as Record<string, string>;
    return map[String(date.getDay())];
  } catch {
    return undefined;
  }
}
