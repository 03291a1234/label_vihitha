/**
 * Business calendar dates, anchored to US Eastern Time (America/New_York, EST/EDT with DST).
 *
 * The boutique operates on Eastern time and orders/finance rows are stored on that clock, so
 * "today"/"yesterday" and every date default must be computed in Eastern — never with
 * `Date.toISOString().slice(0,10)` (UTC), which lands on the wrong calendar day for a viewer
 * whose browser is behind UTC in the evening or ahead of UTC in the early morning. Using a
 * fixed zone also means an IST viewer and an EDT viewer see the same "today".
 */
const TZ = 'America/New_York';

/** Eastern calendar date for an instant (default: now), as `yyyy-mm-dd`. */
export function easternToday(at: Date = new Date()): string {
  // en-CA formats as yyyy-mm-dd.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(at);
}

/** Split a `yyyy-mm-dd` string into a DST-safe UTC-noon anchor for calendar arithmetic. */
function anchor(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)); // noon avoids any DST ±1h day-boundary crossing
}
function fmt(d: Date): string {
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Eastern today shifted by whole days (negative = past), as `yyyy-mm-dd`. */
export function easternDatePlusDays(days: number): string {
  const a = anchor(easternToday());
  a.setUTCDate(a.getUTCDate() + days);
  return fmt(a);
}

/** Eastern today shifted back by whole months, as `yyyy-mm-dd`. */
export function easternMonthsAgo(n: number): string {
  const a = anchor(easternToday());
  a.setUTCMonth(a.getUTCMonth() - n);
  return fmt(a);
}

/** Current year on the Eastern clock. */
export function easternYear(): number {
  return Number(easternToday().slice(0, 4));
}

/**
 * The literal calendar date a user picked in a local date widget, as `yyyy-mm-dd`.
 * A datepicker hands back a Date at that day's *local* midnight, so read its local parts —
 * `toISOString()` here would shift the day. Use this only for an explicitly picked Date;
 * for "today"/relative dates use {@link easternToday} and friends.
 */
export function localDateStr(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
