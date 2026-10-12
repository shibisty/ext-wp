// Date/time value handling for the picker fields.
//
// Inside the panel every date-ish field holds ONE canonical string, the same
// format the native <input type="date|datetime-local|time"> uses, so the
// input's .value can be read and written without conversion:
//
//   date      "YYYY-MM-DD"
//   datetime  "YYYY-MM-DDTHH:MM"   (or "...:SS" when the stored seconds aren't :00)
//   time      "HH:MM"              (or "HH:MM:SS", same rule)
//
// Providers convert from/to their storage format at the edges (ACF stores
// date_picker as "Ymd", date_time_picker as "Y-m-d H:i:s"; WP core and
// WooCommerce use "YYYY-MM-DDTHH:MM:SS"). No timezone conversion happens
// anywhere: all of these are site-local wall-clock times in WordPress.

export type DateKind = 'date' | 'datetime' | 'time';

export const DATE_KINDS: ReadonlySet<string> = new Set<DateKind>(['date', 'datetime', 'time']);

export function isDateKind(type: string): type is DateKind {
  return DATE_KINDS.has(type);
}

const pad = (n: number) => String(n).padStart(2, '0');

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

function isRealTime(h: number, mi: number, s: number): boolean {
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 && s >= 0 && s <= 59;
}

function fmtTime(h: number, mi: number, s: number): string {
  return s ? `${pad(h)}:${pad(mi)}:${pad(s)}` : `${pad(h)}:${pad(mi)}`;
}

// "2026-05-21", "20260521", optionally followed by a time part we ignore here.
const DATE_RE = /^(\d{4})-?(\d{2})-?(\d{2})(?=$|[T ])/;
// Time part after the date: "T10:30", " 10:30:15", trailing zone ignored.
const DATETIME_RE = /^(\d{4})-?(\d{2})-?(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parse anything date-like into canonical "YYYY-MM-DD".
 * Returns '' for empty input and null when the value is not a real date
 * (e.g. an already-formatted "21 Травня, 2026").
 */
export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return '';
  const m = DATE_RE.exec(String(value).trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return isRealDate(y, mo, d) ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Parse into canonical "YYYY-MM-DDTHH:MM[:SS]". Date-only input becomes midnight. */
export function parseDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return '';
  const m = DATETIME_RE.exec(String(value).trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [h, mi, s] = [Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)];
  if (!isRealDate(y, mo, d) || !isRealTime(h, mi, s)) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${fmtTime(h, mi, s)}`;
}

/** Parse into canonical "HH:MM[:SS]". */
export function parseTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return '';
  const m = TIME_RE.exec(String(value).trim());
  if (!m) return null;
  const [h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
  return isRealTime(h, mi, s) ? fmtTime(h, mi, s) : null;
}

export function parseByKind(kind: DateKind, value: unknown): string | null {
  if (kind === 'date') return parseDate(value);
  if (kind === 'datetime') return parseDateTime(value);
  return parseTime(value);
}

function withSeconds(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

// ---- Storage formats ----

/** ACF date_picker storage: "Ymd". */
export function toAcfDate(canonical: string): string {
  return canonical.replace(/-/g, '');
}

/** ACF date_time_picker storage: "Y-m-d H:i:s". */
export function toAcfDateTime(canonical: string): string {
  const [date, time = '00:00'] = canonical.split('T');
  return `${date} ${withSeconds(time)}`;
}

/** ACF time_picker storage: "H:i:s". */
export function toAcfTime(canonical: string): string {
  return withSeconds(canonical);
}

/** WP core / WooCommerce REST: "YYYY-MM-DDTHH:MM:SS" (site-local, no zone). */
export function toWpDateTime(canonical: string): string {
  const [date, time = '00:00'] = canonical.split('T');
  return `${date}T${withSeconds(time)}`;
}

// ---- "Today" / "Now" buttons ----

export function nowValue(kind: DateKind, now: Date = new Date()): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (kind === 'date') return date;
  if (kind === 'time') return time;
  return `${date}T${time}`;
}

/** Native input type for each kind. */
export function inputTypeFor(kind: DateKind): 'date' | 'datetime-local' | 'time' {
  return kind === 'datetime' ? 'datetime-local' : kind;
}

/** Native pickers hide seconds unless step allows them — show them only if the value has them. */
export function stepFor(kind: DateKind, canonical: string): string | null {
  if (kind === 'date') return null;
  const time = kind === 'datetime' ? canonical.split('T')[1] || '' : canonical;
  return time.length === 8 ? '1' : null;
}

/** Human-readable preview (used under the input as a sanity check, e.g. weekday). */
export function describe(kind: DateKind, canonical: string, locale: string): string {
  if (!canonical || kind === 'time') return '';
  const [date, time] = canonical.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h = 0, mi = 0] = (time || '').split(':').map(Number);
  const dt = new Date(y, m - 1, d, h, mi);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  if (kind === 'datetime') Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  try {
    return new Intl.DateTimeFormat(locale, opts).format(dt);
  } catch {
    return '';
  }
}
