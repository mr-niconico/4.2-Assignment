// Date helpers for YYYY-MM-DD strings.
// All maths is done on calendar days in UTC, so time zones and daylight saving never shift a day.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtcMs(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True if the text is a real calendar date written as YYYY-MM-DD (e.g. not 2026-02-30). */
export function isIsoDate(text: unknown): text is string {
  if (typeof text !== "string" || !ISO_DATE.test(text)) return false;
  return fromUtcMs(toUtcMs(text)) === text;
}

/** Number of days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** The date `days` days after `date` (use a negative number to go back). */
export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * 86_400_000);
}

/** The earlier / later of two YYYY-MM-DD dates (they sort as text). */
export function minDate(a: string, b: string): string {
  return a < b ? a : b;
}
export function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

/**
 * The date `days` working days after `date`, skipping Saturdays and Sundays.
 * (Public holidays are not known to the app and are not skipped.)
 */
export function addWorkingDays(date: string, days: number): string {
  let current = date;
  let added = 0;
  while (added < days) {
    current = addDays(current, 1);
    const weekday = new Date(toUtcMs(current)).getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (weekday !== 0 && weekday !== 6) added += 1;
  }
  return current;
}

/** 2026-11-26 → "Thursday, 26 November 2026" */
export function formatLongDate(date: string): string {
  const d = new Date(toUtcMs(date));
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
  const month = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][d.getUTCMonth()];
  return `${weekday}, ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

/** Today's date in the Philippines (YYYY-MM-DD). Only the UI should call this; rules take `today` as a parameter. */
export function todayInManila(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);
}
