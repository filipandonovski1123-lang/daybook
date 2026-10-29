import type { Settings } from './types';

const DAY = 86_400_000;
/** No nagging on day one: wait until someone has used the app for a week. */
export const FIRST_BACKUP_AFTER = 7 * DAY;
export const BACKUP_EVERY = 14 * DAY;
export const BACKUP_SNOOZE = 7 * DAY;

/**
 * Should Today suggest saving a backup? Everything lives on one device, so a lost or reset phone
 * loses it all. Only once there's something worth keeping, and never while snoozed.
 */
export function backupDue(s: Pick<Settings, 'createdAt' | 'lastBackupAt' | 'backupSnoozedUntil'>, hasActivity: boolean, now: number): boolean {
  if (!hasActivity) return false;
  if (s.backupSnoozedUntil && now < s.backupSnoozedUntil) return false;
  if (s.lastBackupAt === null) return now - s.createdAt >= FIRST_BACKUP_AFTER;
  return now - s.lastBackupAt >= BACKUP_EVERY;
}
