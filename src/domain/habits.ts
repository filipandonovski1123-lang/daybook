import { weekdayOf } from './dates';
import type { Habit, HabitEntry, HabitEntryStatus, IsoDate } from './types';

export function isPlannedOn(habit: Pick<Habit, 'days' | 'enabled'>, date: IsoDate): boolean {
  return habit.enabled && habit.days.includes(weekdayOf(date));
}

/** Name to show anywhere outside the habit's own edit screen. */
export function displayName(habit: Pick<Habit, 'name' | 'discreetName' | 'visibility'>): string {
  return habit.visibility !== 'normal' && habit.discreetName ? habit.discreetName : habit.name;
}

export interface EntryInput {
  value?: number | null;
  text?: string;
  /** For activity/awareness/private: the chosen option. */
  option?: string;
  /** For yesno. */
  yes?: boolean;
  done?: boolean;
}

/** Turn what the user logged into a status. Pure — the single source of truth for habit scoring. */
export function statusFor(habit: Pick<Habit, 'input' | 'target' | 'targetMax' | 'options'>, input: EntryInput): HabitEntryStatus | null {
  switch (habit.input) {
    case 'check':
      return input.done ? 'done' : null;
    case 'minutes': {
      const v = input.value ?? null;
      if (v === null) return null;
      const target = habit.target ?? 0;
      if (v >= target) return 'done';
      return v > 0 ? 'partial' : 'missed';
    }
    case 'sleep': {
      const v = input.value ?? null;
      if (v === null) return null;
      const target = habit.target ?? 8;
      if (v >= target) return 'done';
      return v >= target - 1 ? 'partial' : 'missed';
    }
    case 'activity': {
      if (!input.option) return null;
      return /rest/i.test(input.option) ? 'rest' : 'done';
    }
    case 'text':
      return input.text && input.text.trim() ? 'done' : null;
    case 'limit': {
      const v = input.value ?? null;
      if (v === null) return null;
      const max = habit.targetMax ?? 0;
      if (v <= max) return 'done';
      return v <= max * 1.5 ? 'partial' : 'missed';
    }
    case 'yesno':
      if (input.yes === undefined) return null;
      return input.yes ? 'done' : 'missed';
    case 'count': {
      const v = input.value ?? null;
      if (v === null) return null;
      const target = habit.target ?? 1;
      if (v >= target) return 'done';
      return v > 0 ? 'partial' : 'missed';
    }
    case 'awareness': {
      if (!input.option) return null;
      const i = habit.options.indexOf(input.option);
      // "Noticed afterwards" still counts as awareness — half credit, never zero.
      return i === 2 ? 'partial' : 'done';
    }
    case 'private': {
      if (!input.option) return null;
      const i = habit.options.indexOf(input.option);
      return i === 2 ? 'missed' : 'done';
    }
  }
}

export const STATUS_SCORE: Record<HabitEntryStatus, number | null> = {
  done: 1,
  partial: 0.5,
  missed: 0,
  skipped: 0,
  rest: null, // excluded: rest/recovery is a valid plan, not a failure
};

export interface DayAdherence {
  date: IsoDate;
  planned: number;
  score: number;
  /** 0–1, or null when nothing was planned. */
  rate: number | null;
  done: number;
}

/**
 * Adherence for one date. Only habits planned that weekday count. Unplanned extras are logged but
 * never inflate the rate. Sensitive habits are excluded unless `includeSensitive`.
 */
export function dayAdherence(habits: readonly Habit[], entries: readonly HabitEntry[], date: IsoDate, includeSensitive = false): DayAdherence {
  const byHabit = new Map(entries.filter((e) => e.date === date).map((e) => [e.habitId, e]));
  let planned = 0;
  let score = 0;
  let done = 0;
  for (const h of habits) {
    if (!isPlannedOn(h, date)) continue;
    if (h.sensitive && !includeSensitive) continue;
    const e = byHabit.get(h.id);
    const s = e ? STATUS_SCORE[e.status] : 0;
    if (s === null) continue;
    planned++;
    score += s;
    if (e?.status === 'done') done++;
  }
  return { date, planned, score, done, rate: planned ? score / planned : null };
}

export function entryId(habitId: string, date: IsoDate): string {
  return `${habitId}|${date}`;
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
