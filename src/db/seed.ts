import { buildHabits } from '../data/habits';
import { detectTimeZone } from '../domain/dates';
import type { Reminder, Settings } from '../domain/types';
import { db } from './db';
import { RENAMED_TITLES } from '../data/renamedTitles';

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
  await applyTitleRenames();
}

/**
 * Gives saved plans the reworded step titles, but only for challenges still carrying the old title
 * that the person never edited. Safe to run on every start (and after an import or a sync pull).
 */
export async function applyTitleRenames(): Promise<number> {
  return db.transaction('rw', [db.challenges, db.revisions], async () => {
    const stale = await db.challenges.filter((c) => !!c.libraryId && RENAMED_TITLES[c.libraryId]?.from === c.title).toArray();
    let changed = 0;
    for (const c of stale) {
      if ((await db.revisions.where('challengeId').equals(c.id).count()) > 0) continue;
      await db.challenges.update(c.id, { title: RENAMED_TITLES[c.libraryId!]!.to });
      changed++;
    }
    return changed;
  });
}
