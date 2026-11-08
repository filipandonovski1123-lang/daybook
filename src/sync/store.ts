import Dexie, { type EntityTable } from 'dexie';
import type { Session } from './cloud';

/** This device's sync state, in its own small database so it never goes into backups. */
export interface SyncState {
  id: 'sync';
  session: Session;
  /** Non-extractable AES key derived from the password. */
  key: CryptoKey;
  salt: string;
  /** Cloud updatedAt this device last uploaded or downloaded. */
  syncedAt: number;
  /** Number of Firestore parts last written, so stale ones can be deleted. */
  parts: number;
  /** Local changes not yet uploaded. */
  dirty: boolean;
}

export const syncStore = new Dexie('daybook-sync') as Dexie & { state: EntityTable<SyncState, 'id'> };
syncStore.version(1).stores({ state: 'id' });

/** Cheap check used at start-up, so people who never sign in never load the sync code. */
export async function hasSyncAccount(): Promise<boolean> {
  try {
    return (await syncStore.state.count()) > 0;
  } catch {
    return false;
  }
}

/** Fired when someone signs in or out, so the app can start or stop syncing. */
export const SYNC_CHANGED = 'daybook-sync-changed';
export const announceSyncChange = () => window.dispatchEvent(new Event(SYNC_CHANGED));
