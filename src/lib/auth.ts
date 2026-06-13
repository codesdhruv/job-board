const PBKDF2_ITERS = 100_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BYTES = 32;

const enc = new TextEncoder();

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iters: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
    key,
    PBKDF2_HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERS);
  return `pbkdf2$${PBKDF2_ITERS}$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iters = parseInt(parts[1], 10);
  if (!Number.isFinite(iters) || iters < 1) return false;
  const salt = b64ToBytes(parts[2]);
  const expected = b64ToBytes(parts[3]);
  const actual = await pbkdf2(password, salt, iters);
  return constantTimeEqual(actual, expected);
}

export interface SessionPayload {
  adminId: number;
  username: string;
  expiresAt: number;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = bytesToB64(enc.encode(JSON.stringify(payload)));
  const sig = await hmacSha256(secret, body);
  return `${body}.${bytesToB64(sig)}`;
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSha256(secret, body);
  const actual = b64ToBytes(sig);
  if (!constantTimeEqual(actual, expected)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64ToBytes(body)));
  } catch {
    return null;
  }
  if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now()) return null;
  return payload;
}
