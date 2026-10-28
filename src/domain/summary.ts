import { allPbEvents, type ProgressMap } from './stats';
import { addDays } from './dates';
import { dayAdherence, displayName, isPlannedOn } from './habits';
import type { PbEvent } from './criteria';
import type { Attempt, Challenge, ChallengeProgress, Habit, HabitEntry, IsoDate, Reflection } from './types';

/** Longest run of consecutive days with a completed habit or a finished/attempted challenge. */
export function longestStreak(entries: readonly HabitEntry[], progress: readonly ChallengeProgress[]): number {
  const active = new Set<IsoDate>();
  for (const e of entries) if (e.status === 'done' || e.status === 'partial') active.add(e.date);
  for (const p of progress) if (p.completedOn) active.add(p.completedOn);
  let best = 0;
  for (const d of active) {
    if (active.has(addDays(d, -1))) continue; // only count from the start of a run
    let n = 1;
    while (active.has(addDays(d, n))) n++;
    best = Math.max(best, n);
  }
  return best;
}

export interface ProgramSummary {
  /** Real challenges (rest days excluded). */
  total: number;
  completed: number;
  attempted: number;
  missed: number;
  restDays: number;
  pbs: PbEvent[];
  longestStreak: number;
  /** 0–1 across elapsed program days, or null. */
  habitRate: number | null;
  bestHabit: { name: string; rate: number } | null;
  hardestCompleted: Challenge | null;
  reflections: number;
  favouriteReflection: Reflection | null;
  sessions: number;
}

export function programSummary(args: {
  challenges: readonly Challenge[];
  progress: ProgressMap;
  attempts: readonly Attempt[];
  habits: readonly Habit[];
  entries: readonly HabitEntry[];
  reflections: readonly Reflection[];
  /** Program dates elapsed so far (Day 1 … min(today, last day)). */
  dates: readonly IsoDate[];
  missed: number;
}): ProgramSummary {
  const real = args.challenges.filter((c) => c.kind !== 'rest');
  const status = (c: Challenge) => args.progress.get(c.id)?.status;
  const completed = real.filter((c) => status(c) === 'completed');

  let planned = 0;
  let score = 0;
  for (const d of args.dates) {
    const a = dayAdherence(args.habits, args.entries, d);
    planned += a.planned;
    score += a.score;
  }

  // Best habit: highest completion rate over at least 3 planned days. Private habits are excluded.
  let bestHabit: ProgramSummary['bestHabit'] = null;
  for (const h of args.habits) {
    if (h.sensitive || !h.enabled) continue;
    const days = args.dates.filter((d) => isPlannedOn(h, d));
    if (days.length < 3) continue;
    const done = days.filter((d) => args.entries.some((e) => e.habitId === h.id && e.date === d && e.status === 'done')).length;
    const rate = done / days.length;
    if (!bestHabit || rate > bestHabit.rate) bestHabit = { name: displayName(h), rate };
  }

  const written = args.reflections.filter((r) => r.updatedAt && (r.entry || r.takeaway || r.proud || r.improvement));
  const favouriteReflection = [...written].sort((a, b) => (b.mood ?? 0) - (a.mood ?? 0) || (b.takeaway ? 1 : 0) - (a.takeaway ? 1 : 0) || b.date.localeCompare(a.date))[0] ?? null;

  return {
    total: real.length,
    completed: completed.length,
    attempted: real.filter((c) => status(c) === 'attempted').length,
    missed: args.missed,
    restDays: args.challenges.length - real.length,
    pbs: allPbEvents(real, args.progress, args.attempts).sort((a, b) => b.improvementPct - a.improvementPct),
    longestStreak: longestStreak(args.entries, [...args.progress.values()]),
    habitRate: planned ? score / planned : null,
    bestHabit,
    hardestCompleted: [...completed].sort((a, b) => b.difficulty - a.difficulty || b.estimatedMinutes - a.estimatedMinutes)[0] ?? null,
    reflections: written.length,
    favouriteReflection,
    sessions: args.attempts.length,
  };
}
