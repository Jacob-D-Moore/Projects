import type { Bindings, NavItem, Settings } from '../types';

export async function loadSettings(db: D1Database): Promise<Settings> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

export async function loadNav(db: D1Database): Promise<NavItem[]> {
  const { results } = await db
    .prepare('SELECT slug, title FROM pages WHERE published = 1 AND show_in_nav = 1 ORDER BY nav_order, title')
    .all<{ slug: string; title: string }>();
  return results.map((p) => ({ href: `/p/${p.slug}`, label: p.title }));
}

export async function audit(env: Bindings, userId: number | null, action: string, detail: string, ip: string | null) {
  await env.DB.prepare('INSERT INTO audit_log (user_id, action, detail, ip) VALUES (?, ?, ?, ?)')
    .bind(userId, action, detail.slice(0, 500), ip)
    .run();
}

/**
 * Sliding-window rate limit backed by D1. Returns true if the action is allowed.
 * Every call counts as an attempt.
 */
export async function rateLimit(db: D1Database, bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const since = now - windowSec;
  const row = await db.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ? AND ts > ?').bind(bucket, since).first<{ n: number }>();
  if ((row?.n ?? 0) >= limit) return false;
  await db.batch([
    db.prepare('INSERT INTO rate_limits (bucket, ts) VALUES (?, ?)').bind(bucket, now),
    db.prepare('DELETE FROM rate_limits WHERE ts < ?').bind(now - 86400),
  ]);
  return true;
}

export async function clearRateLimit(db: D1Database, bucket: string) {
  await db.prepare('DELETE FROM rate_limits WHERE bucket = ?').bind(bucket).run();
}

/** Current date/time in the church's time zone as 'YYYY-MM-DDTHH:MM'. */
export function churchNow(tz = 'America/New_York'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);
}
