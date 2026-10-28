import { addDays, diffDays } from './dates';
import type { Challenge, ChallengeProgress, DisplayStatus, IsoDate } from './types';

/** Length of the original program; also the default for data created before lengths were configurable. */
export const DEFAULT_PROGRAM_DAYS = 30;

export function endDateFor(startDate: IsoDate, length: number = DEFAULT_PROGRAM_DAYS): IsoDate {
  return addDays(startDate, length - 1);
}

/** Original scheduled date for a program day. Day 1 = start date. */
export function scheduledDateFor(startDate: IsoDate, day: number): IsoDate {
  return addDays(startDate, day - 1);
}

/** Program day number for a date: <1 before start, >30 after end. */
export function programDayFor(startDate: IsoDate, date: IsoDate): number {
  return diffDays(startDate, date) + 1;
}

export type ProgramPhase = 'before' | 'active' | 'after';

export function programPhase(startDate: IsoDate, today: IsoDate, length: number = DEFAULT_PROGRAM_DAYS): ProgramPhase {
  const d = programDayFor(startDate, today);
  if (d < 1) return 'before';
  if (d > length) return 'after';
  return 'active';
}

/** The date a challenge is currently due: the reschedule date if any, else its original slot. */
export function effectiveDate(startDate: IsoDate, challenge: Pick<Challenge, 'day'>, progress?: Pick<ChallengeProgress, 'rescheduledTo'> | null): IsoDate {
  return progress?.rescheduledTo ?? scheduledDateFor(startDate, challenge.day);
}

export function displayStatus(
  startDate: IsoDate,
  today: IsoDate,
  challenge: Pick<Challenge, 'day'>,
  progress?: Pick<ChallengeProgress, 'status' | 'rescheduledTo'> | null,
): DisplayStatus {
  const s = progress?.status ?? 'not_started';
  if (s === 'completed') return 'completed';
  if (s === 'attempted') return 'attempted';
  if (s === 'in_progress' || s === 'paused') return 'in_progress';
  const due = effectiveDate(startDate, challenge, progress);
  if (due > today) return progress?.rescheduledTo ? 'rescheduled' : 'upcoming';
  if (due === today) return 'available';
  return 'missed';
}

/** A challenge whose due date is in the future may only be completed with an explicit override. */
export function isFuture(startDate: IsoDate, today: IsoDate, challenge: Pick<Challenge, 'day'>, progress?: Pick<ChallengeProgress, 'rescheduledTo'> | null): boolean {
  return effectiveDate(startDate, challenge, progress) > today;
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  upcoming: 'Upcoming',
  available: 'Available',
  in_progress: 'In progress',
  completed: 'Completed',
  attempted: 'Attempted',
  missed: 'Missed',
  rescheduled: 'Rescheduled',
};
