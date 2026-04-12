/** 日ごとの事業所名配列から、事業所別の利用日数（日カウント）を集計する */
export function countDaysByFacility(dayFacilities: Record<number, string[]>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const names of Object.values(dayFacilities)) {
    for (const fname of names) {
      if (!fname) continue;
      counts[fname] = (counts[fname] ?? 0) + 1;
    }
  }
  return counts;
}

export function facilityCountsList(counts: Record<string, number>): { name: string; days: number }[] {
  return Object.entries(counts)
    .map(([name, days]) => ({ name, days }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}
