import { timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';

export function safeCompare(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    const maxLen = Math.max(a.length, b.length);
    const paddedA = Buffer.alloc(maxLen);
    const paddedB = Buffer.alloc(maxLen);
    a.copy(paddedA);
    b.copy(paddedB);
    return timingSafeEqual(paddedA, paddedB) && a.length === b.length;
  }
  return timingSafeEqual(a, b);
}

export function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored, storedSalt) {
  if (!stored || !password) return false;
  // Support two formats: NEW "salt:hash" or OLD (hash stored, salt separate)
  let salt, hash;
  if (stored.includes(':')) {
    const parts = stored.split(':');
    if (parts.length >= 2) { salt = parts[0]; hash = parts[1]; }
  } else if (storedSalt) {
    salt = storedSalt;
    hash = stored;
  }
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64).toString('hex');
  return safeCompare(derived, hash);
}

export function generateSalt(length = 16) {
  return randomBytes(length).toString('hex');
}
