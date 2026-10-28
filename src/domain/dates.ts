import type { IsoDate, LocalTime } from './types';

/**
 * Date helpers. Calendar dates are plain `YYYY-MM-DD` strings and all day arithmetic is done in UTC,
 * so daylight-saving transitions can never make a "day" 23 or 25 hours long or skip a date.
 * Converting between a wall-clock time in a timezone and an instant goes through Intl.
 */

export const DEFAULT_TIMEZONE = 'Australia/Sydney';

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && isValidTimeZone(tz)) return tz;
  } catch {
    /* fall through */
  }
  return DEFAULT_TIMEZONE;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(ms: number, tz: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year ?? 1970,
    month: out.month ?? 1,
    day: out.day ?? 1,
    hour: (out.hour ?? 0) % 24,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function toIso(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parseIso(d: IsoDate): { year: number; month: number; day: number } {
  const [y, m, dd] = d.split('-').map(Number);
  return { year: y ?? 1970, month: m ?? 1, day: dd ?? 1 };
}

export function isValidIso(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const { year, month, day } = parseIso(d);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

/** Today's calendar date in `tz`. */
export function todayIn(tz: string, now: number = Date.now()): IsoDate {
  const p = zonedParts(now, tz);
  return toIso(p.year, p.month, p.day);
}

export function nowTimeIn(tz: string, now: number = Date.now()): LocalTime {
  const p = zonedParts(now, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

function isoToUtcMs(d: IsoDate): number {
  const { year, month, day } = parseIso(d);
  return Date.UTC(year, month - 1, day);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  const dt = new Date(isoToUtcMs(d) + n * 86_400_000);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Whole days from `a` to `b` (b − a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((isoToUtcMs(b) - isoToUtcMs(a)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(d: IsoDate): number {
  return new Date(isoToUtcMs(d)).getUTCDay();
}

/** Monday of the ISO week containing `d`. */
export function weekStart(d: IsoDate): IsoDate {
  const wd = weekdayOf(d);
  return addDays(d, wd === 0 ? -6 : 1 - wd);
}

export function minutesOf(t: LocalTime): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(mins: number): LocalTime {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Offset of `tz` from UTC at instant `ms`, in milliseconds (e.g. +11h for Sydney in summer). */
export function tzOffsetMs(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `tz` reads `date time`.
 * Times inside a spring-forward gap resolve to the first valid instant after the gap;
 * ambiguous fall-back times resolve to the earlier (first) occurrence.
 */
export function zonedToEpoch(date: IsoDate, time: LocalTime, tz: string): number {
  const { year, month, day } = parseIso(date);
  const [h, m] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, h ?? 0, m ?? 0);
  // Try both candidate offsets (before/after any transition near this wall time).
  const o1 = tzOffsetMs(wall - 86_400_000 / 2, tz);
  const o2 = tzOffsetMs(wall + 86_400_000 / 2, tz);
  const candidates = [wall - o1, wall - o2].sort((a, b) => a - b);
  for (const c of candidates) {
    const p = zonedParts(c, tz);
    if (toIso(p.year, p.month, p.day) === date && p.hour === h && p.minute === m) return c;
  }
  // In a DST gap: no candidate matches. Use the instant just after the gap.
  return Math.max(...candidates);
}

export function startOfDayEpoch(date: IsoDate, tz: string): number {
  return zonedToEpoch(date, '00:00', tz);
}

export function endOfDayEpoch(date: IsoDate, tz: string): number {
  return startOfDayEpoch(addDays(date, 1), tz);
}

/** Is wall time `t` inside a [start, end) window that may wrap past midnight? */
export function inWindow(t: LocalTime, start: LocalTime, end: LocalTime): boolean {
  const x = minutesOf(t);
  const s = minutesOf(start);
  const e = minutesOf(end);
  if (s === e) return false;
  return s < e ? x >= s && x < e : x >= s || x < e;
}

/** Hours between bedtime and wake time, handling past-midnight. */
export function hoursBetween(bed: LocalTime, wake: LocalTime): number {
  let mins = minutesOf(wake) - minutesOf(bed);
  if (mins <= 0) mins += 1440;
  return Math.round((mins / 60) * 100) / 100;
}

// ---------------------------------------------------------------- formatting

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function dateFmt(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' });
    fmtCache.set(key, f);
  }
  return f;
}

export function formatDate(d: IsoDate, style: 'long' | 'short' | 'weekday' | 'dm' = 'long'): string {
  const ms = isoToUtcMs(d);
  switch (style) {
    case 'long':
      return dateFmt('long', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(ms);
    case 'short':
      return dateFmt('short', { weekday: 'short', day: 'numeric', month: 'short' }).format(ms);
    case 'weekday':
      return dateFmt('weekday', { weekday: 'short' }).format(ms);
    case 'dm':
      return dateFmt('dm', { day: 'numeric', month: 'short' }).format(ms);
  }
}

export function formatTime(t: LocalTime): string {
  const [h, m] = t.split(':').map(Number);
  return dateFmt('time', { hour: 'numeric', minute: '2-digit' }).format(Date.UTC(2000, 0, 1, h ?? 0, m ?? 0));
}

export function formatInstant(ms: number, tz: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ms);
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
