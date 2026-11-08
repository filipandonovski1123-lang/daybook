import { describe, expect, it } from 'vitest';
import { decryptText, deriveKey, encryptText, fromBase64, randomBytes, toBase64 } from './crypto';

describe('sync encryption', () => {
  it('round-trips text and never stores it in plain form', async () => {
    const salt = randomBytes(16);
    const key = await deriveKey('correct horse battery staple', salt);
    const secret = JSON.stringify({ reflection: 'A private thought about today.' });
    const box = await encryptText(key, secret);
    expect(atob(box.data)).not.toContain('private thought');
    expect(await decryptText(key, box.iv, box.data)).toBe(secret);
  });

  it('refuses the wrong password and tampered data', async () => {
    const salt = randomBytes(16);
    const box = await encryptText(await deriveKey('right', salt), 'hello');
    await expect(decryptText(await deriveKey('wrong', salt), box.iv, box.data)).rejects.toThrow();
    const bytes = fromBase64(box.data);
    bytes[0]! ^= 1;
    await expect(decryptText(await deriveKey('right', salt), box.iv, toBase64(bytes))).rejects.toThrow();
  });

  it('handles large payloads', async () => {
    const key = await deriveKey('pw', randomBytes(16));
    const big = 'x'.repeat(2_000_000);
    const box = await encryptText(key, big);
    expect((await decryptText(key, box.iv, box.data)).length).toBe(2_000_000);
  });
});
