import { addDays, inWindow, nowTimeIn, todayIn, zonedToEpoch } from './dates';
import { programDayFor } from './schedule';
import type { IsoDate, Reminder, ReminderType, Settings } from './types';

/** A reminder that comes due while the app is closed is still shown if the app opens within this window. */
export const REMINDER_GRACE_MS = 2 * 60 * 60 * 1000;

export const REMINDER_LABEL: Record<ReminderType, string> = {
  morning: 'Morning plan',
  evening: 'Evening check-in',
  bedtime: 'Bedtime routine',
};

export function isQuiet(time: string, quiet: Settings['quietHours']): boolean {
  return quiet.enabled && inWindow(time, quiet.start, quiet.end);
}

export interface DueReminder {
  reminder: Reminder;
  date: IsoDate;
  fireAt: number;
  suppressed: boolean;
}

/**
 * Reminders that are due now and have not yet been delivered today. Duplicate protection is by
 * `${id}|${date}` in the notification log, so each reminder fires at most once per local day even
 * across tabs and restarts. Uses the user's timezone, so DST shifts the instant, not the wall time.
 */
export function dueReminders(reminders: readonly Reminder[], settings: Pick<Settings, 'timezone' | 'quietHours'>, now: number, delivered: ReadonlySet<string>): DueReminder[] {
  const tz = settings.timezone;
  const today = todayIn(tz, now);
  const out: DueReminder[] = [];
  for (const r of reminders) {
    if (!r.enabled) continue;
    for (const date of [addDays(today, -1), today]) {
      if (delivered.has(`${r.id}|${date}`)) continue;
      const fireAt = zonedToEpoch(date, r.time, tz);
      if (now >= fireAt && now - fireAt < REMINDER_GRACE_MS) {
        out.push({ reminder: r, date, fireAt, suppressed: isQuiet(r.time, settings.quietHours) });
      }
    }
  }
  return out;
}

export interface ScheduledItem {
  type: ReminderType;
  at: number;
  date: IsoDate;
  suppressed: boolean;
}

/** Upcoming reminder instants for the next `days` days, for display. */
export function upcomingSchedule(reminders: readonly Reminder[], settings: Pick<Settings, 'timezone' | 'quietHours'>, now: number, days = 2): ScheduledItem[] {
  const tz = settings.timezone;
  const today = todayIn(tz, now);
  const out: ScheduledItem[] = [];
  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i);
    for (const r of reminders) {
      if (!r.enabled) continue;
      const at = zonedToEpoch(date, r.time, tz);
      if (at > now) out.push({ type: r.type, at, date, suppressed: isQuiet(r.time, settings.quietHours) });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export interface ReminderContext {
  startDate: IsoDate | null;
  /** Program length in days. */
  length: number;
  date: IsoDate;
  challengeTitle: string | null;
  hardMode: boolean;
  openItems: number;
}

/**
 * Notification text. Deliberately generic: never includes habit names, so sensitive goals can't
 * appear on a lock screen.
 */
export function reminderMessage(type: ReminderType, ctx: ReminderContext): { title: string; body: string } {
  const day = ctx.startDate ? programDayFor(ctx.startDate, ctx.date) : null;
  if (type === 'morning') {
    if (day === null || day < 1) {
      const inDays = day === null ? null : 1 - day;
      return { title: 'Your challenge', body: inDays ? `Your challenge starts in ${inDays} day${inDays > 1 ? 's' : ''}. Check your preparation list.` : 'Open your plan for today.' };
    }
    if (day > ctx.length) return { title: 'Your challenge', body: 'The program is finished. Open the app to review your progress.' };
    return {
      title: `Day ${day}/${ctx.length}`,
      body: ctx.hardMode
        ? `Day ${day}/${ctx.length}. ${ctx.challengeTitle ? `Today: ${ctx.challengeTitle}. ` : ''}Plan it now, then go do it.`
        : `Day ${day}/${ctx.length} is ready. Today's challenge: ${ctx.challengeTitle ?? 'see app'}. Open your checklist and plan your day.`,
    };
  }
  if (type === 'evening') {
    return {
      title: 'Daily check-in',
      body: ctx.hardMode && ctx.openItems > 0
        ? `${ctx.openItems} commitment${ctx.openItems > 1 ? 's' : ''} still open. You've still got time. Use it.`
        : 'Time for your daily check-in. Review your challenge, habits and progress.',
    };
  }
  return { title: 'Wind down', body: 'Time to start your bedtime routine. Screens away soon.' };
}

export function nowLocal(tz: string, now = Date.now()) {
  return { date: todayIn(tz, now), time: nowTimeIn(tz, now) };
}
