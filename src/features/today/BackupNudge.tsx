import { HardDrive } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui';
import { snoozeBackupReminder } from '../../db/actions';
import { backupDue } from '../../domain/backupReminder';
import { useAction, useApp } from '../../lib/appData';
import { saveBackup } from '../../lib/backupFile';

/** A quiet card on Today every couple of weeks: everything lives on this device, so keep a copy. */
export function BackupNudge() {
  const { data } = useApp();
  // Read the clock once per mount; the reminder doesn't need to appear mid-session.
  const [now] = useState(() => Date.now());
  const save = useAction(() => saveBackup(true), { success: 'Backup saved. Keep the file somewhere safe, like cloud storage or email.' });
  const later = useAction(() => snoozeBackupReminder());
  const hasActivity = data.progress.size > 0 || data.entries.length > 0 || data.reflections.length > 0;
  if (!backupDue(data.settings, hasActivity, now)) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
      <HardDrive className="mt-0.5 size-4 shrink-0 text-slate" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">Back up your progress</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">Everything lives only on this device. Save a backup file so a lost or reset phone doesn’t lose your progress.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" busy={save.busy} onClick={() => void save.run()}>
            Save backup
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void later.run()}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
