// Password hashing — Node's built-in scrypt (no extra dependency).
// Stored format: `<saltHex>:<hashHex>`. Use `verifyPassword` for constant-time
// comparison. Swap for argon2id in v1.0 if the threat model demands it.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const KEY_LEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(plain, salt, KEY_LEN)) as Buffer;
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = (await scrypt(plain, salt, expected.length || KEY_LEN)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
