export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthStart(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1, 0, 0, 0, 0);
}

export function monthEndExclusive(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 1, 0, 0, 0, 0);
}

export function isDateInMonthKey(dateText: string, monthKey: string): boolean {
  return dateText.startsWith(`${monthKey}-`);
}

