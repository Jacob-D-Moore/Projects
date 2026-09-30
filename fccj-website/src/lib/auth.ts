import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env, Session, User } from '../types';
import { randomToken, safeEqual, sha256Hex } from './security';

const SESSION_TTL_SEC = 12 * 60 * 60; // absolute lifetime: 12 hours
const IDLE_TTL_SEC = 2 * 60 * 60;     // sign out after 2 hours of inactivity
const MFA_PENDING_TTL_SEC = 5 * 60;   // time allowed to enter a 2FA code

export function cookieName(c: Context<Env>) {
  // The __Host- prefix forces Secure, Path=/, and no Domain, which blocks
  // subdomain cookie injection. It requires HTTPS, so local dev uses a plain name.
  return insecureDev(c) ? 'fccj_session' : '__Host-fccj_session';
}

function insecureDev(c: Context<Env>) {
  return c.env.DEV_INSECURE_COOKIES === 'true';
}

export function clientIp(c: Context<Env>): string {
  return c.req.header('CF-Connecting-IP') ?? '0.0.0.0';
}

export async function createSession(c: Context<Env>, userId: number, mfaPending: boolean) {
  const raw = randomToken(32);
  const now = Math.floor(Date.now() / 1000);
  const ttl = mfaPending ? MFA_PENDING_TTL_SEC : SESSION_TTL_SEC;
  await c.env.DB.prepare(
    'INSERT INTO sessions (id_hash, user_id, csrf_token, mfa_pending, created_at, expires_at, last_seen, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(await sha256Hex(raw), userId, randomToken(24), mfaPending ? 1 : 0, now, now + ttl, now, clientIp(c), (c.req.header('User-Agent') ?? '').slice(0, 200))
    .run();
  setCookie(c, cookieName(c), raw, {
    httpOnly: true,
    secure: !insecureDev(c),
    sameSite: 'Strict',
    path: '/',
    maxAge: ttl,
  });
}

export async function destroySession(c: Context<Env>) {
  const raw = getCookie(c, cookieName(c));
  if (raw) await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256Hex(raw)).run();
  deleteCookie(c, cookieName(c), { path: '/', secure: !insecureDev(c) });
}

/** Look up the current session. Returns null if missing, expired, idle, or the user is disabled. */
export async function readSession(c: Context<Env>): Promise<{ session: Session; user: User } | null> {
  const raw = getCookie(c, cookieName(c));
  if (!raw || raw.length > 100) return null;
  const idHash = await sha256Hex(raw);
  const now = Math.floor(Date.now() / 1000);
  const row = await c.env.DB.prepare(
    `SELECT s.id_hash, s.user_id, s.csrf_token, s.mfa_pending, s.expires_at, s.last_seen,
            u.id, u.email, u.name, u.role, u.totp_enabled, u.disabled
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id_hash = ?`
  ).bind(idHash).first<Session & User & { last_seen: number; disabled: number }>();
  if (!row) return null;
  if (row.expires_at < now || row.disabled || (!row.mfa_pending && row.last_seen + IDLE_TTL_SEC < now)) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(idHash).run();
    return null;
  }
  if (now - row.last_seen > 60) {
    await c.env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE id_hash = ?').bind(now, idHash).run();
  }
  return {
    session: { id_hash: row.id_hash, user_id: row.user_id, csrf_token: row.csrf_token, mfa_pending: row.mfa_pending, expires_at: row.expires_at },
    user: { id: row.id, email: row.email, name: row.name, role: row.role, totp_enabled: row.totp_enabled },
  };
}

/** Reject cross-site form posts: the browser-supplied Origin must match this host. */
export function sameOrigin(c: Context<Env>): boolean {
  const origin = c.req.header('Origin');
  const host = new URL(c.req.url).host;
  if (origin) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  // Older browsers may omit Origin on same-origin POSTs; fall back to Sec-Fetch-Site.
  const site = c.req.header('Sec-Fetch-Site');
  return !site || site === 'same-origin';
}

/** Require a fully signed-in user, and a valid CSRF token on every state-changing request. */
export const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  const found = await readSession(c);
  if (!found || found.session.mfa_pending) {
    const back = encodeURIComponent(new URL(c.req.url).pathname);
    return c.redirect(`/admin/login?next=${back}`);
  }
  c.set('user', found.user);
  c.set('session', found.session);

  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    if (!sameOrigin(c)) return c.text('Cross-site request blocked.', 403);
    const ct = c.req.header('Content-Type') ?? '';
    let token = c.req.header('X-CSRF-Token') ?? '';
    if (!token && (ct.includes('form'))) {
      const body = await c.req.parseBody();
      token = typeof body._csrf === 'string' ? body._csrf : '';
    }
    if (!token || !safeEqual(token, found.session.csrf_token)) {
      return c.text('Your session form token is invalid or expired. Go back, refresh the page, and try again.', 403);
    }
  }
  await next();
};

export const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
  if (c.get('user')?.role !== 'admin') return c.text('Only administrators can do that.', 403);
  await next();
};
