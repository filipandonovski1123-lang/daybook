import { buildHabits } from '../data/habits';
import { detectTimeZone } from '../domain/dates';
import type { Reminder, Settings } from '../domain/types';
import { db } from './db';

export function defaultSettings(now = Date.now()): Settings {
  return {
    id: 'settings',
    displayName: '',
    timezone: detectTimeZone(),
    wakeTime: '07:30',
    sleepTargetHours: 8.5,
    bedtime: '22:30',
    quietHours: { enabled: true, start: '22:30', end: '07:00' },
    theme: 'light',
    palette: 'editorial',
    hardMode: false,
    reducedMotion: 'system',
    hideSensitiveOnToday: false,
    // Nearly everyone has these; the rest is ticked in Settings so setup stays short.
    equipment: ['recorder', 'camera', 'kitchen'],
    constraints: '',
    onboarded: false,
    lifeStage: 'early',
    lastBackupAt: null,
    backupSnoozedUntil: null,
    createdAt: now,
  };
}

export function defaultReminders(): Reminder[] {
  return [
    { id: 'morning', type: 'morning', time: '08:00', enabled: true, delivery: 'system' },
    { id: 'evening', type: 'evening', time: '20:30', enabled: true, delivery: 'system' },
    { id: 'bedtime', type: 'bedtime', time: '22:00', enabled: false, delivery: 'system' },
  ];
}

/**
 * Seed what the app needs before anything renders: settings, habits and reminders. Idempotent and
 * never overwrites existing records. Challenges come from setup, so the challenge library isn't
 * needed at start-up (ensureSeeded in actions.ts also adds the starter challenges).
 */
export async function seedBasics(now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.settings, db.habits, db.reminders], async () => {
    if (!(await db.settings.get('settings'))) await db.settings.add(defaultSettings(now));
    if ((await db.habits.count()) === 0) await db.habits.bulkAdd(buildHabits());
    if ((await db.reminders.count()) === 0) await db.reminders.bulkAdd(defaultReminders());
  });
}
