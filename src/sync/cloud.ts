import { FIREBASE } from './config';

/**
 * Minimal Firebase client over its REST APIs (no SDK, so nothing loads until someone signs in).
 * Auth: Identity Toolkit email/password. Storage: one Firestore document per user holding encrypted
 * data, split into parts to stay under Firestore's 1 MiB document limit.
 */

export class CloudError extends Error {
  constructor(
    message: string,
    readonly code = '',
  ) {
    super(message);
  }
}

export interface Session {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
  /** Epoch ms when idToken expires. */
  expiresAt: number;
}

/** What's stored in the cloud: everything needed to decrypt except the password. */
export interface CloudSnapshot {
  salt: string;
  iv: string;
  data: string;
  updatedAt: number;
  device: string;
}

const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts';
const TOKEN = 'https://securetoken.googleapis.com/v1/token';
const PART = 900_000;

const FRIENDLY: Record<string, string> = {
  EMAIL_EXISTS: 'There’s already an account with that email. Try signing in instead.',
  EMAIL_NOT_FOUND: 'Email or password is incorrect.',
  INVALID_PASSWORD: 'Email or password is incorrect.',
  INVALID_LOGIN_CREDENTIALS: 'Email or password is incorrect.',
  USER_DISABLED: 'This account has been disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a few minutes and try again.',
  INVALID_EMAIL: 'That email address doesn’t look right.',
  WEAK_PASSWORD: 'Use a password of at least 8 characters.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Please sign in again to do that.',
  TOKEN_EXPIRED: 'Please sign in again.',
  OPERATION_NOT_ALLOWED: 'Accounts aren’t switched on for this app yet.',
};

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new CloudError('Can’t reach the sync service. Check your connection.', 'NETWORK');
  }
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } } & T;
  if (!res.ok) {
    const raw = body.error?.message ?? body.error?.status ?? `HTTP_${res.status}`;
    const code = raw.split(' ')[0]!.split(':')[0]!;
    throw new CloudError(FRIENDLY[code] ?? 'Something went wrong with sync. Please try again.', code);
  }
  return body;
}

function toSession(r: { localId: string; email: string; idToken: string; refreshToken: string; expiresIn: string }): Session {
  return { uid: r.localId, email: r.email, idToken: r.idToken, refreshToken: r.refreshToken, expiresAt: Date.now() + Number(r.expiresIn) * 1000 };
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export async function signUp(email: string, password: string): Promise<Session> {
  return toSession(await call(`${AUTH}:signUp?key=${FIREBASE.apiKey}`, json({ email, password, returnSecureToken: true })));
}

export async function signIn(email: string, password: string): Promise<Session> {
  return toSession(await call(`${AUTH}:signInWithPassword?key=${FIREBASE.apiKey}`, json({ email, password, returnSecureToken: true })));
}

export async function sendPasswordReset(email: string): Promise<void> {
  await call(`${AUTH}:sendOobCode?key=${FIREBASE.apiKey}`, json({ requestType: 'PASSWORD_RESET', email }));
}

/** A session with a token valid for at least another minute. */
export async function fresh(s: Session): Promise<Session> {
  if (s.expiresAt - Date.now() > 60_000) return s;
  const r = await call<{ id_token: string; refresh_token: string; expires_in: string; user_id: string }>(`${TOKEN}?key=${FIREBASE.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refreshToken }),
  });
  return { ...s, idToken: r.id_token, refreshToken: r.refresh_token, expiresAt: Date.now() + Number(r.expires_in) * 1000 };
}

// ---------------------------------------------------------------- Firestore

const DOCS = () => `projects/${FIREBASE.projectId}/databases/(default)/documents`;
const FS = () => `https://firestore.googleapis.com/v1/${DOCS()}`;
const auth = (s: Session) => ({ Authorization: `Bearer ${s.idToken}`, 'Content-Type': 'application/json' });

type Fields = Record<string, { stringValue?: string; integerValue?: string }>;

/** The encrypted snapshot, or null if this account has never synced. */
export async function download(s: Session): Promise<CloudSnapshot | null> {
  let meta: { fields: Fields };
  try {
    meta = await call(`${FS()}/sync/${s.uid}`, { headers: auth(s) });
  } catch (e) {
    if (e instanceof CloudError && (e.code === 'HTTP_404' || e.code === 'NOT_FOUND')) return null;
    throw e;
  }
  const f = meta.fields;
  const parts = Number(f.parts?.integerValue ?? 0);
  const chunks = await Promise.all(Array.from({ length: parts }, (_, i) => call<{ fields: Fields }>(`${FS()}/sync/${s.uid}/parts/${i}`, { headers: auth(s) })));
  return {
    salt: f.salt?.stringValue ?? '',
    iv: f.iv?.stringValue ?? '',
    data: chunks.map((c) => c.fields.data?.stringValue ?? '').join(''),
    updatedAt: Number(f.updatedAt?.integerValue ?? 0),
    device: f.device?.stringValue ?? '',
  };
}

/** Just the timestamp, to check for newer data cheaply. */
export async function remoteUpdatedAt(s: Session): Promise<number | null> {
  try {
    const meta = await call<{ fields: Fields }>(`${FS()}/sync/${s.uid}?mask.fieldPaths=updatedAt`, { headers: auth(s) });
    return Number(meta.fields.updatedAt?.integerValue ?? 0);
  } catch (e) {
    if (e instanceof CloudError && (e.code === 'HTTP_404' || e.code === 'NOT_FOUND')) return null;
    throw e;
  }
}

/** Replace the snapshot in one atomic commit (old extra parts are deleted). */
export async function upload(s: Session, snap: CloudSnapshot, previousParts = 0): Promise<void> {
  const parts: string[] = [];
  for (let i = 0; i < snap.data.length; i += PART) parts.push(snap.data.slice(i, i + PART));
  const name = (path: string) => `${DOCS()}/sync/${s.uid}${path}`;
  const writes: unknown[] = [
    {
      update: {
        name: name(''),
        fields: { salt: { stringValue: snap.salt }, iv: { stringValue: snap.iv }, updatedAt: { integerValue: String(snap.updatedAt) }, device: { stringValue: snap.device }, parts: { integerValue: String(parts.length) } },
      },
    },
    ...parts.map((data, i) => ({ update: { name: name(`/parts/${i}`), fields: { data: { stringValue: data } } } })),
  ];
  for (let i = parts.length; i < previousParts; i++) writes.push({ delete: name(`/parts/${i}`) });
  await call(`${FS()}:commit`, { method: 'POST', headers: auth(s), body: JSON.stringify({ writes }) });
}

/** Delete the cloud copy and the account itself. */
export async function deleteEverything(s: Session, parts: number): Promise<void> {
  const name = (path: string) => `${DOCS()}/sync/${s.uid}${path}`;
  const writes = [{ delete: name('') }, ...Array.from({ length: Math.max(parts, 1) }, (_, i) => ({ delete: name(`/parts/${i}`) }))];
  await call(`${FS()}:commit`, { method: 'POST', headers: auth(s), body: JSON.stringify({ writes }) });
  await call(`${AUTH}:delete?key=${FIREBASE.apiKey}`, json({ idToken: s.idToken }));
}
