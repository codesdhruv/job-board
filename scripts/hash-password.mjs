const password = process.argv[2];
if (!password) {
  console.error('usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}

const ITERS = 100_000;
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey(
  'raw',
  enc.encode(password),
  { name: 'PBKDF2' },
  false,
  ['deriveBits'],
);
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt, iterations: ITERS, hash: 'SHA-256' },
  key,
  256,
);
const b64 = (u8) => Buffer.from(u8).toString('base64');
console.log(`pbkdf2$${ITERS}$${b64(salt)}$${b64(new Uint8Array(bits))}`);
