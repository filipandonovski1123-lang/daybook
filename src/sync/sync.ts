import Dexie from 'dexie';
import { exportData, importData, parseBackup } from '../db/backup';
import { db } from '../db/db';
import { CloudError, deleteEverything, download, fresh, remoteUpdatedAt, signIn, signUp, upload, type CloudSnapshot } from './cloud';
import { decryptText, deriveKey, encryptText, fromBase64, randomBytes, toBase64 } from './crypto';
import { announceSyncChange, syncStore, type SyncState } from './store';

/**
 * Optional, end-to-end encrypted sync. Everything except photo/file evidence is exported, encrypted
 * with a key derived from the password, and stored as one snapshot per account. Each device keeps:
 *   - its session and its (non-extractable) key, in a separate small database that never goes into
 *     backups, and
 *   - when it last matched the cloud and whether it has changed since.
 * Last-writer-wins, except that when both this device and the cloud changed, the user chooses.
 */

const store = syncStore;

export interface SyncStatus {
  email: string;
  syncedAt: number;
  dirty: boolean;
}

export type SyncOutcome = 'uploaded' | 'downloaded' | 'up-to-date' | 'conflict';

const device = () => (typeof navigator === 'undefined' ? 'unknown' : `${navigator.platform || 'device'}`.slice(0, 60));

async function getState(): Promise<SyncState | undefined> {
  return store.state.get('sync');
}

export async function status(): Promise<SyncStatus | null> {
  const s = await getState();
  return s ? { email: s.session.email, syncedAt: s.syncedAt, dirty: s.dirty } : null;
}

async function withFreshSession(s: SyncState): Promise<SyncState> {
  const session = await fresh(s.session);
  if (session === s.session) return s;
  const next = { ...s, session };
  await store.state.put(next);
  return next;
}

// ---------------------------------------------------------------- upload / download

let applyingRemote = false;

async function push(s: SyncState): Promise<SyncState> {
  s = await withFreshSession(s);
  const backup = await exportData(false);
  const box = await encryptText(s.key, JSON.stringify(backup));
  const snap: CloudSnapshot = { salt: s.salt, iv: box.iv, data: box.data, updatedAt: Date.now(), device: device() };
  await upload(s.session, snap, s.parts);
  const next: SyncState = { ...s, syncedAt: snap.updatedAt, parts: Math.ceil(snap.data.length / 900_000), dirty: false };
  await store.state.put(next);
  return next;
}

async function decryptSnapshot(key: CryptoKey, snap: CloudSnapshot) {
  let text: string;
  try {
    text = await decryptText(key, snap.iv, snap.data);
  } catch {
    throw new CloudError('Your synced data can’t be unlocked with this password. If you reset your password, the old cloud copy can’t be read any more.', 'DECRYPT');
  }
  const parsed = parseBackup(text);
  if (!parsed.ok) throw new CloudError('The synced data couldn’t be read.', 'CORRUPT');
  return parsed.backup;
}

async function applySnapshot(s: SyncState, snap: CloudSnapshot): Promise<SyncState> {
  const backup = await decryptSnapshot(s.key, snap);
  applyingRemote = true;
  try {
    await importData(backup, { keepLocalFiles: true });
  } finally {
    // storagemutated fires after the transaction; let it pass before watching again.
    setTimeout(() => (applyingRemote = false), 0);
  }
  const next: SyncState = { ...s, syncedAt: snap.updatedAt, parts: Math.ceil(snap.data.length / 900_000), dirty: false };
  await store.state.put(next);
  return next;
}

/** Has this device got real data worth protecting (a plan has been set up)? */
async function hasLocalData(): Promise<boolean> {
  return !!(await db.settings.get('settings'))?.onboarded;
}

// ---------------------------------------------------------------- account actions

/** New account: this device's data becomes the first cloud copy. */
export async function createAccount(email: string, password: string): Promise<void> {
  const session = await signUp(email.trim(), password);
  const salt = randomBytes(16);
  const state: SyncState = { id: 'sync', session, key: await deriveKey(password, salt), salt: toBase64(salt), syncedAt: 0, parts: 0, dirty: true };
  await store.state.put(state);
  await push(state);
  announceSyncChange();
}

/**
 * Sign in on this device. With no cloud copy yet, this device's data is uploaded. With a cloud copy
 * and nothing set up here, it's downloaded. With both, returns 'conflict' and the user decides.
 */
export async function signInAccount(email: string, password: string): Promise<SyncOutcome> {
  const session = await signIn(email.trim(), password);
  const snap = await download(session);
  if (!snap) {
    const salt = randomBytes(16);
    const state: SyncState = { id: 'sync', session, key: await deriveKey(password, salt), salt: toBase64(salt), syncedAt: 0, parts: 0, dirty: true };
    await store.state.put(state);
    await push(state);
    announceSyncChange();
    return 'uploaded';
  }
  const key = await deriveKey(password, fromBase64(snap.salt));
  await decryptSnapshot(key, snap); // check the password unlocks it before saving anything
  const conflict = await hasLocalData();
  // An unanswered conflict stays one until the user chooses — sync never picks for them.
  const state: SyncState = { id: 'sync', session, key, salt: snap.salt, syncedAt: conflict ? AWAITING_CHOICE : 0, parts: Math.ceil(snap.data.length / 900_000), dirty: true };
  await store.state.put(state);
  announceSyncChange();
  if (conflict) return 'conflict';
  await applySnapshot(state, snap);
  return 'downloaded';
}

/** syncedAt while this device and the cloud both have data and the user hasn't chosen yet. */
const AWAITING_CHOICE = -1;

/** After a password reset the old cloud copy can't be decrypted: start a new one from this device. */
export async function replaceCloudWithDevice(email: string, password: string): Promise<void> {
  const session = await signIn(email.trim(), password);
  const prev = await download(session).catch(() => null);
  const salt = randomBytes(16);
  const state: SyncState = { id: 'sync', session, key: await deriveKey(password, salt), salt: toBase64(salt), syncedAt: 0, parts: prev ? Math.ceil(prev.data.length / 900_000) : 0, dirty: true };
  await store.state.put(state);
  await push(state);
  announceSyncChange();
}

/** Resolve a conflict: keep this device's data (upload) or the cloud's (download). */
export async function resolveConflict(keep: 'device' | 'cloud'): Promise<void> {
  let s = await getState();
  if (!s) return;
  if (keep === 'device') {
    await push(s);
    return;
  }
  s = await withFreshSession(s);
  const snap = await download(s.session);
  if (snap) await applySnapshot(s, snap);
}

/** Upload local changes or download newer ones. Never overwrites unsynced changes silently. */
export async function syncNow(): Promise<SyncOutcome> {
  let s = await getState();
  if (!s) return 'up-to-date';
  if (s.syncedAt === AWAITING_CHOICE) return 'conflict';
  s = await withFreshSession(s);
  const remote = await remoteUpdatedAt(s.session);
  if (remote !== null && remote > s.syncedAt) {
    if (s.dirty && s.syncedAt > 0) return 'conflict';
    const snap = await download(s.session);
    if (snap) await applySnapshot(s, snap);
    return 'downloaded';
  }
  if (s.dirty || remote === null) {
    await push(s);
    return 'uploaded';
  }
  return 'up-to-date';
}

/** Stop syncing on this device. Its data stays; the cloud copy stays for other devices. */
export async function signOut(): Promise<void> {
  await store.state.delete('sync');
  announceSyncChange();
}

/** Delete the cloud copy and the account. Needs the password again; this device's data stays. */
export async function deleteAccount(password: string): Promise<void> {
  const s = await getState();
  if (!s) return;
  const session = await signIn(s.session.email, password);
  await deleteEverything(session, s.parts);
  await store.state.delete('sync');
  announceSyncChange();
}

// ---------------------------------------------------------------- automatic sync

/** Note a local change to upload on the next sync. */
export async function markDirty(): Promise<void> {
  const s = await getState();
  if (s && !s.dirty) await store.state.put({ ...s, dirty: true });
}

/** Tables whose changes are worth syncing (not timers ticking or the notification log). */
const IGNORED = new Set(['timers', 'notificationLog', 'evidenceFiles']);

/**
 * Watch for local changes and sync a few seconds after them, and check for newer data when the app
 * comes back to the foreground or goes online. Returns a stop function.
 */
export function startAutoSync(onOutcome: (o: SyncOutcome | Error) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  const run = async () => {
    if (running || !navigator.onLine) return;
    running = true;
    try {
      onOutcome(await syncNow());
    } catch (e) {
      onOutcome(e instanceof Error ? e : new Error(String(e)));
    } finally {
      running = false;
    }
  };
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), ms);
  };
  const onMutated = (parts: Record<string, unknown>) => {
    if (applyingRemote) return;
    const touched = Object.keys(parts).some((k) => {
      const m = /^idb:\/\/([^/]+)\/([^/]+)\//.exec(k);
      return m && m[1] === db.name && !IGNORED.has(m[2]!);
    });
    if (!touched) return;
    void getState().then((s) => {
      if (!s) return;
      void markDirty();
      schedule(4000);
    });
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') schedule(500);
  };
  const onOnline = () => schedule(500);
  Dexie.on('storagemutated', onMutated);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  schedule(1000);
  return () => {
    clearTimeout(timer);
    Dexie.on('storagemutated').unsubscribe(onMutated);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}
