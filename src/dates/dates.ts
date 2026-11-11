/** Calendar dates are stored as local "YYYY-MM-DD" strings so they never shift across time zones. */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toLocalDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  if (!date) return dateString;
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

/** Returns null for anything that is not a real calendar date (e.g. 2026-02-30). */
export function parseLocalDate(dateString: string): Date | null {
  const match = DATE_PATTERN.exec(dateString);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const isRealDate = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isRealDate ? date : null;
}

export function isValidDateString(value: string): boolean {
  return parseLocalDate(value) !== null;
}

const displayFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' });

/** "2026-11-11" → "November 11, 2026". */
export function formatDisplayDate(dateString: string): string {
  const date = parseLocalDate(dateString);
  return date ? displayFormatter.format(date) : dateString;
}
