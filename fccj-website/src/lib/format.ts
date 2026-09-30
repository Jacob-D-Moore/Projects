const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parse(local: string) {
  const [d, t = '00:00'] = local.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return { y, m, day, h, min, dow: new Date(Date.UTC(y, m - 1, day)).getUTCDay() };
}

export function fmtTime(local: string): string {
  const { h, min } = parse(local);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

export function fmtDate(local: string, withDay = true): string {
  const { y, m, day, dow } = parse(local);
  return `${withDay ? DAYS[dow] + ', ' : ''}${MONTHS[m - 1]} ${day}, ${y}`;
}

export function dateBadge(local: string) {
  const { m, day } = parse(local);
  return { month: MONTHS[m - 1], day: String(day) };
}

export function fmtEventWhen(starts: string, ends: string | null, allDay: number): string {
  const startDate = starts.slice(0, 10);
  if (allDay) {
    if (ends && ends.slice(0, 10) !== startDate) return `${fmtDate(starts)} – ${fmtDate(ends)}`;
    return fmtDate(starts);
  }
  if (ends && ends.slice(0, 10) === startDate) return `${fmtDate(starts)} · ${fmtTime(starts)} – ${fmtTime(ends)}`;
  if (ends) return `${fmtDate(starts)} ${fmtTime(starts)} – ${fmtDate(ends)} ${fmtTime(ends)}`;
  return `${fmtDate(starts)} · ${fmtTime(starts)}`;
}

/** Extract a YouTube video id from common URL shapes, for privacy-enhanced embeds. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.hostname.endsWith('youtube.com') || u.hostname.endsWith('youtube-nocookie.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/(embed|live|shorts)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch { /* ignore */ }
  return null;
}

export function mediaUrl(key: string | null | undefined): string | null {
  return key ? `/media/${encodeURIComponent(key)}` : null;
}
