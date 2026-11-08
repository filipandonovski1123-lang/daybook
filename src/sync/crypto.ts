/**
 * End-to-end encryption for sync. The key is derived from the user's password on their device
 * (PBKDF2-SHA-256 → AES-256-GCM) and never leaves it, so the server only ever stores ciphertext.
 * Forgetting the password means the cloud copy can't be decrypted — by design.
 */

const ITERATIONS = 310_000;

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** A non-extractable AES key: usable on this device, impossible to read back out. */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(key: CryptoKey, text: string): Promise<{ iv: string; data: string }> {
  const iv = randomBytes(12);
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(text));
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(buf)) };
}

/** Throws if the key is wrong or the data was tampered with (GCM authenticates it). */
export async function decryptText(key: CryptoKey, iv: string, data: string): Promise<string> {
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) as BufferSource }, key, fromBase64(data) as BufferSource);
  return new TextDecoder().decode(buf);
}
