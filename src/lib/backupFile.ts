import { markBackedUp } from '../db/actions';
import { exportData } from '../db/backup';
import { downloadText } from './download';

/** Export everything to a dated JSON file and remember when, for the backup reminder. */
export async function saveBackup(includeFiles = true): Promise<void> {
  const b = await exportData(includeFiles);
  downloadText(`daybook-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b), 'application/json');
  await markBackedUp();
}
