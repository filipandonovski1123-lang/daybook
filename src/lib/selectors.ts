import { useMemo } from 'react';
import { addDays } from '../domain/dates';
import { displayName, isPlannedOn } from '../domain/habits';
import { displayStatus, effectiveDate, PROGRAM_DAYS, programDayFor, programPhase, scheduledDateFor, type ProgramPhase } from '../domain/schedule';
import { challengeCounts, statusesFor, type ChallengeCounts } from '../domain/stats';
import type { Challenge, DisplayStatus, Habit, IsoDate } from '../domain/types';
import { useApp } from './appData';

export interface ProgramView {
  startDate: IsoDate;
  endDate: IsoDate;
  phase: ProgramPhase;
  /** Raw program day for today (may be <1 or >30). */
  dayRaw: number;
  /** Clamped 1–30 for display. */
  day: number;
  statuses: Map<string, DisplayStatus>;
  counts: ChallengeCounts;
  todayChallenge: Challenge | null;
  tomorrowChallenge: Challenge | null;
  /** Other challenges due today because they were rescheduled to today. */
  catchUps: Challenge[];
  /** Missed challenges not yet acknowledged. */
  unacknowledgedMissed: Challenge[];
  missed: Challenge[];
  dateOf: (c: Challenge) => IsoDate;
  originalDateOf: (c: Challenge) => IsoDate;
}

export function useProgramView(): ProgramView | null {
  const { data, today } = useApp();
  return useMemo(() => {
    const p = data.program;
    if (!p) return null;
    const start = p.startDate;
    const statuses = statusesFor(start, today, data.challenges, data.progress);
    const dayRaw = programDayFor(start, today);
    const byDay = (d: number) => data.challenges.find((c) => c.day === d) ?? null;
    const todayChallenge = dayRaw >= 1 && dayRaw <= PROGRAM_DAYS ? byDay(dayRaw) : null;
    const tomorrowChallenge = dayRaw + 1 >= 1 && dayRaw + 1 <= PROGRAM_DAYS ? byDay(dayRaw + 1) : null;
    const catchUps = data.challenges.filter((c) => c.id !== todayChallenge?.id && data.progress.get(c.id)?.rescheduledTo === today && statuses.get(c.id) !== 'completed');
    const missed = data.challenges.filter((c) => statuses.get(c.id) === 'missed');
    const unacknowledgedMissed = missed.filter((c) => !data.progress.get(c.id)?.missedAck);
    return {
      startDate: start,
      endDate: p.endDate,
      phase: programPhase(start, today),
      dayRaw,
      day: Math.max(1, Math.min(PROGRAM_DAYS, dayRaw)),
      statuses,
      counts: challengeCounts(statuses),
      todayChallenge,
      tomorrowChallenge,
      catchUps,
      missed,
      unacknowledgedMissed,
      dateOf: (c) => effectiveDate(start, c, data.progress.get(c.id)),
      originalDateOf: (c) => scheduledDateFor(start, c.day),
    };
  }, [data, today]);
}

export function useStatusOf(challenge: Challenge): DisplayStatus {
  const { data, today } = useApp();
  if (!data.program) return 'upcoming';
  return displayStatus(data.program.startDate, today, challenge, data.progress.get(challenge.id));
}

export interface TodayHabitGroups {
  essential: Habit[];
  scheduled: Habit[];
  personal: Habit[];
  evening: Habit[];
  unplanned: Habit[];
}

export function habitGroupsFor(habits: readonly Habit[], date: IsoDate, hideSensitive: boolean): TodayHabitGroups {
  const g: TodayHabitGroups = { essential: [], scheduled: [], personal: [], evening: [], unplanned: [] };
  for (const h of habits) {
    if (!h.enabled) continue;
    if (h.sensitive && (hideSensitive || h.visibility === 'hidden')) continue;
    if (!isPlannedOn(h, date)) {
      g.unplanned.push(h);
      continue;
    }
    g[h.section].push(h);
  }
  return g;
}

export function habitLabel(h: Habit): string {
  return displayName(h);
}

export const tomorrowOf = (d: IsoDate) => addDays(d, 1);
