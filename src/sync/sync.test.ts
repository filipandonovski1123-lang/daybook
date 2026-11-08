import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as A from '../db/actions';
import { db } from '../db/db';
import * as S from './sync';

/** An in-memory stand-in for Firebase Auth + Firestore's REST APIs. */
function fakeFirebase() {
  const users = new Map<string, { uid: string; password: string }>();
  const docs = new Map<string, Record<string, unknown>>();
  let n = 0;
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const err = (status: number, message: string) => reply(status, { error: { message, status: message } });
  const session = (email: string, uid: string) => ({ localId: uid, email, idToken: `tok-${uid}`, refreshToken: `ref-${uid}`, expiresIn: '3600' });
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    const uidFromAuth = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '').replace('Bearer tok-', '');
    if (url.pathname.endsWith('accounts:signUp')) {
      if (users.has(body.email)) return err(400, 'EMAIL_EXISTS');
      const uid = `u${++n}`;
      users.set(body.email, { uid, password: body.password });
      return reply(200, session(body.email, uid));
    }
    if (url.pathname.endsWith('accounts:signInWithPassword')) {
      const u = users.get(body.email);
      return u && u.password === body.password ? reply(200, session(body.email, u.uid)) : err(400, 'INVALID_LOGIN_CREDENTIALS');
    }
    if (url.pathname.endsWith('accounts:delete')) {
      for (const [email, u] of users) if (`tok-${u.uid}` === body.idToken) users.delete(email);
      return reply(200, {});
    }
    if (url.pathname.endsWith(':commit')) {
      for (const w of body.writes) {
        const path = String(w.update?.name ?? w.delete).split('/documents/')[1]!;
        if (!path.startsWith(`sync/${uidFromAuth}`)) return err(403, 'PERMISSION_DENIED'); // mirrors firestore.rules
        if (w.update) docs.set(path, w.update.fields);
        else docs.delete(path);
      }
      return reply(200, {});
    }
    const path = decodeURIComponent(url.pathname).split('/documents/')[1];
    if (path) {
      if (!path.startsWith(`sync/${uidFromAuth}`)) return err(403, 'PERMISSION_DENIED');
      const fields = docs.get(path);
      return fields ? reply(200, { fields }) : err(404, 'NOT_FOUND');
    }
    return err(400, 'UNKNOWN');
  };
  return { fetchFn, docs, users };
}

/** Wipe this "device" (data and sync state) to play a second device. */
async function newDevice() {
  await S.signOut();
  await db.delete();
  await db.open();
  await A.ensureSeeded();
}

let cloud: ReturnType<typeof fakeFirebase>;
beforeEach(async () => {
  cloud = fakeFirebase();
  vi.stubGlobal('fetch', cloud.fetchFn);
  await newDevice();
});
afterEach(() => vi.unstubAllGlobals());

describe('encrypted sync', () => {
  it('carries data to a second device, and the server only sees ciphertext', async () => {
    await A.updateSettings({ displayName: 'Sam Example', onboarded: true });
    await S.createAccount('sam@example.com', 'a long password');
    const stored = JSON.stringify([...cloud.docs.values()]);
    expect(stored).not.toContain('Sam Example');
    expect(stored).not.toContain('sam@example.com');

    await newDevice();
    expect(await S.signInAccount('sam@example.com', 'a long password')).toBe('downloaded');
    expect((await db.settings.get('settings'))?.displayName).toBe('Sam Example');
    expect((await S.status())?.email).toBe('sam@example.com');
  });

  it('uploads local changes and pulls newer ones', async () => {
    await A.updateSettings({ displayName: 'Before', onboarded: true });
    await S.createAccount('a@example.com', 'password one');
    expect(await S.syncNow()).toBe('up-to-date');

    await A.updateSettings({ displayName: 'After' });
    await S.markDirty();
    expect(await S.syncNow()).toBe('uploaded');

    await newDevice();
    await S.signInAccount('a@example.com', 'password one');
    expect((await db.settings.get('settings'))?.displayName).toBe('After');
  });

  it('asks before overwriting a device that already has a plan, then honours the choice', async () => {
    await A.updateSettings({ displayName: 'Cloud copy', onboarded: true });
    await S.createAccount('b@example.com', 'password two');

    await newDevice();
    await A.updateSettings({ displayName: 'This phone', onboarded: true });
    expect(await S.signInAccount('b@example.com', 'password two')).toBe('conflict');
    expect((await db.settings.get('settings'))?.displayName).toBe('This phone'); // nothing changed yet
    // Closing the question without answering must not let automatic sync pick a side.
    expect(await S.syncNow()).toBe('conflict');
    expect((await db.settings.get('settings'))?.displayName).toBe('This phone');
    await S.resolveConflict('cloud');
    expect((await db.settings.get('settings'))?.displayName).toBe('Cloud copy');
  });

  it('flags a conflict when two devices both changed since they last synced', async () => {
    await A.updateSettings({ displayName: 'One', onboarded: true });
    await S.createAccount('f@example.com', 'password six');
    // Another device uploads a newer copy behind this one's back…
    const meta = [...cloud.docs.entries()].find(([k]) => !k.includes('/parts/'))!;
    meta[1].updatedAt = { integerValue: String(Date.now() + 60_000) };
    // …while this device also changed.
    await A.updateSettings({ displayName: 'Two' });
    await S.markDirty();
    expect(await S.syncNow()).toBe('conflict');
    expect((await db.settings.get('settings'))?.displayName).toBe('Two');
  });

  it('rejects a wrong password and leaves the device signed out', async () => {
    await S.createAccount('c@example.com', 'right password');
    await newDevice();
    await expect(S.signInAccount('c@example.com', 'wrong password')).rejects.toThrow(/incorrect/);
    expect(await S.status()).toBeNull();
  });

  it('keeps photos stored on this device when pulling', async () => {
    await A.updateSettings({ onboarded: true });
    await db.evidence.add({ id: 'ev1', challengeId: 'day-01', name: 'proof.jpg', mime: 'image/jpeg', size: 3, tag: 'other', caption: '', createdAt: 1 });
    await db.evidenceFiles.add({ id: 'ev1', bytes: new Uint8Array([1, 2, 3]).buffer });
    await S.createAccount('d@example.com', 'password four');
    await S.resolveConflict('cloud'); // pull the cloud copy (which has no file bytes) onto this device
    expect(await db.evidence.get('ev1')).toBeTruthy();
    expect(new Uint8Array((await db.evidenceFiles.get('ev1'))!.bytes)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('deletes the cloud copy and the account', async () => {
    await S.createAccount('e@example.com', 'password five');
    expect(cloud.docs.size).toBeGreaterThan(0);
    await S.deleteAccount('password five');
    expect(cloud.docs.size).toBe(0);
    expect(cloud.users.size).toBe(0);
    expect(await S.status()).toBeNull();
  });
});
