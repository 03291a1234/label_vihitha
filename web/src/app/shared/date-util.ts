/**
 * Dates are stored in UTC and shown in the viewer's local timezone (Angular's `date` pipe
 * localizes automatically once a value carries a UTC 'Z'). So "today"/"yesterday" are the
 * viewer's LOCAL calendar day — a shop opened in Central Time sees CT days, in Eastern sees ET.
 *
 * For filtering instant columns (e.g. an order's timestamp) we hand the API that local day's
 * UTC instant boundaries, so an order placed late evening — already the next date in UTC — still
 * counts under the local day it actually happened.
 */

function fmtLocal(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Viewer's local calendar date today, as `yyyy-mm-dd`. */
export function todayLocal(): string { return fmtLocal(new Date()); }
/** Local date n days ago, as `yyyy-mm-dd`. */
export function daysAgoLocal(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return fmtLocal(d); }
/** Local date n months ago, as `yyyy-mm-dd`. */
export function monthsAgoLocal(n: number): string { const d = new Date(); d.setMonth(d.getMonth() - n); return fmtLocal(d); }
/** Current local year. */
export function yearLocal(): number { return new Date().getFullYear(); }
/** The literal calendar date a datepicker handed back (its local midnight), as `yyyy-mm-dd`. */
export function localDateStr(d: Date): string { return fmtLocal(d); }

/** Start of a local `yyyy-mm-dd` day, as a UTC ISO instant (inclusive lower bound). */
export function localDayStartUtc(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toISOString();
}
/** Start of the NEXT local day after `yyyy-mm-dd`, as a UTC ISO instant (exclusive upper bound). */
export function localDayEndUtc(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}
