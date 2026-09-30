// Cryptographic helpers built only on the Web Crypto API (no third-party crypto).

const enc = new TextEncoder();

export function bytesToB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  return bytesToB64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i % ab.length] ?? 0) ^ (bb[i % bb.length] ?? 0);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Passwords: PBKDF2-HMAC-SHA256. 100,000 iterations is the maximum the
// Cloudflare Workers runtime permits; the format stores the count so it can
// be raised later without invalidating existing hashes.
// ---------------------------------------------------------------------------
const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${bytesToB64url(salt)}$${bytesToB64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iter, salt, hash] = stored.split('$');
  if (algo !== 'pbkdf2_sha256' || !iter || !salt || !hash) return false;
  const computed = await pbkdf2(password, b64urlToBytes(salt), Number(iter));
  return safeEqual(bytesToB64url(computed), hash);
}

/** A hash to verify against when the user does not exist, so timing doesn't reveal valid emails. */
export const DUMMY_HASH = 'pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export function passwordProblems(pw: string): string | null {
  if (pw.length < 12) return 'Password must be at least 12 characters long.';
  if (pw.length > 256) return 'Password is too long.';
  const common = ['password', '123456', 'qwerty', 'letmein', 'welcome', 'jesus', 'church', 'fccj'];
  const lower = pw.toLowerCase();
  if (common.some((w) => lower.includes(w)) && new Set(lower).size < 8) return 'Password is too easy to guess. Try a short phrase of unrelated words.';
  return null;
}

// ---------------------------------------------------------------------------
// TOTP two-factor authentication (RFC 6238, compatible with Google
// Authenticator, Microsoft Authenticator, 1Password, Authy, etc.)
// ---------------------------------------------------------------------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export function newTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(counter));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

/**
 * Verify a 6-digit code, allowing one 30s step of clock drift. Returns the
 * matched time step (store it to block replay of the same code) or null.
 */
export async function verifyTotp(secretB32: string, code: string, lastUsedStep: number): Promise<number | null> {
  const digits = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(digits)) return null;
  const secret = base32Decode(secretB32);
  const now = Math.floor(Date.now() / 1000 / 30);
  for (const step of [now - 1, now, now + 1]) {
    if (step <= lastUsedStep) continue;
    if (safeEqual(await hotp(secret, step), digits)) return step;
  }
  return null;
}

export function totpUri(secretB32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ---------------------------------------------------------------------------
// Output safety helpers
// ---------------------------------------------------------------------------
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Only allow http(s), mailto, tel, and same-site relative URLs. Blocks javascript:, data:, etc. */
export function safeUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim();
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return url;
  if (url.startsWith('#')) return url;
  try {
    const u = new URL(url);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol)) return u.toString();
  } catch { /* not a URL */ }
  return null;
}
