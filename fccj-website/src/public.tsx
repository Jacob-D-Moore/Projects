import { Hono } from 'hono';
import type { Env, EventRow, MinistryRow, PageRow, SermonRow, StaffRow } from './types';
import { Layout, PageHero, Prose } from './views/layout';
import { renderMarkdown } from './lib/markdown';
import { churchNow, rateLimit } from './lib/db';
import { dateBadge, fmtDate, fmtEventWhen, mediaUrl, youtubeId } from './lib/format';
import { safeUrl } from './lib/security';
import { clientIp, sameOrigin } from './lib/auth';

const app = new Hono<Env>();

function page(c: any, title: string | undefined, body: any, description?: string, status = 200) {
  return c.html(
    <Layout s={c.get('settings')} nav={c.get('nav')} title={title} description={description} path={new URL(c.req.url).pathname}>
      {body}
    </Layout>,
    status
  );
}

function EventCard({ e }: { e: EventRow }) {
  const b = dateBadge(e.starts_at);
  return (
    <a class="event-card" href={`/events/${e.id}`}>
      <div class="date-badge"><span>{b.month}</span><strong>{b.day}</strong></div>
      <div>
        <h3>{e.title}</h3>
        <p class="muted small">{fmtEventWhen(e.starts_at, e.ends_at, e.all_day)}{e.location ? ` · ${e.location}` : ''}</p>
        {e.summary && <p>{e.summary}</p>}
      </div>
    </a>
  );
}

function MinistryCard({ m }: { m: MinistryRow }) {
  const img = mediaUrl(m.image_key);
  return (
    <a class="card ministry-card" href={`/ministries/${m.slug}`}>
      {img ? <img src={img} alt="" loading="lazy" /> : <div class="card-art" aria-hidden="true">{m.name.charAt(0)}</div>}
      <div class="card-body">
        <p class="eyebrow">{m.audience}</p>
        <h3>{m.name}</h3>
        <p>{m.summary}</p>
      </div>
    </a>
  );
}

function VideoEmbed({ url, title }: { url: string; title: string }) {
  const id = youtubeId(url);
  if (id && /^[\w-]{6,20}$/.test(id)) {
    return (
      <div class="video">
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title={title} loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" />
      </div>
    );
  }
  const safe = safeUrl(url);
  return safe ? <p><a class="btn" href={safe} target="_blank" rel="noopener noreferrer">Watch this message</a></p> : null;
}

// ---------------------------------------------------------------- Home
app.get('/', async (c) => {
  const s = c.get('settings');
  const now = churchNow();
  const [events, ministries, sermon] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM events WHERE published = 1 AND COALESCE(ends_at, starts_at) >= ? ORDER BY featured DESC, starts_at LIMIT 3').bind(now).all<EventRow>(),
    c.env.DB.prepare('SELECT * FROM ministries WHERE published = 1 ORDER BY sort_order, name LIMIT 6').all<MinistryRow>(),
    c.env.DB.prepare('SELECT * FROM sermons WHERE published = 1 ORDER BY preached_on DESC LIMIT 1').first<SermonRow>(),
  ]);
  const hero = mediaUrl(s.hero_image_key);
  const live = safeUrl(s.livestream_url);
  const upcoming = events.results.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return page(c, undefined, <>
    <section class={`hero${hero ? ' has-image' : ''}`}>
      {hero && <img class="hero-img" src={hero} alt="" />}
      <div class="wrap hero-inner">
        <p class="eyebrow light">Welcome to {s.church_name}</p>
        <h1>{s.hero_heading}</h1>
        <p class="lead">{s.hero_subheading}</p>
        <div class="actions">
          <a class="btn btn-gold" href="/p/plan-a-visit">Plan Your Visit</a>
          {live ? <a class="btn btn-ghost" href={live} target="_blank" rel="noopener noreferrer">Watch Online</a>
                : <a class="btn btn-ghost" href="/sermons">Watch Sermons</a>}
        </div>
      </div>
    </section>

    <section class="times">
      <div class="wrap times-grid">
        <div><span class="time">{s.time_classes}</span><span>Bible study classes for all ages</span></div>
        <div><span class="time">{s.time_worship}</span><span>Worship service with communion</span></div>
        <div><span class="time">Kids</span><span>Classes &amp; worship, birth–5th grade</span></div>
      </div>
    </section>

    <section class="section">
      <div class="wrap split">
        <div>
          <p class="eyebrow">New here?</p>
          <h2>We would love to meet you.</h2>
          <p>You will be welcomed into a friendly, casual environment by people who are excited to see you. Our Sunday service is about 70 minutes: the FCCJ band leads worship, we share communion together, and our minister brings a message from the Bible.</p>
          <p class="actions">
            <a class="btn" href="/p/plan-a-visit">What to expect</a>
            <a class="btn btn-outline" href="/p/starting-point">Starting Point</a>
          </p>
        </div>
        <div class="info-card">
          <h3>Find us</h3>
          <p><strong>{s.address_street}</strong><br />{s.address_city}</p>
          {s.address_note && <p class="muted small">{s.address_note}</p>}
          <p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.address_street}, ${s.address_city}`)}`} target="_blank" rel="noopener noreferrer">Get directions →</a></p>
        </div>
      </div>
    </section>

    {ministries.results.length > 0 && (
      <section class="section alt">
        <div class="wrap">
          <div class="section-head"><h2>Find your place</h2><a href="/ministries">All ministries →</a></div>
          <div class="grid-3">{ministries.results.map((m) => <MinistryCard m={m} />)}</div>
        </div>
      </section>
    )}

    <section class="section">
      <div class="wrap">
        <div class="section-head"><h2>Coming up</h2><a href="/events">Full calendar →</a></div>
        {upcoming.length ? <div class="event-list">{upcoming.map((e) => <EventCard e={e} />)}</div>
          : <p class="muted">No upcoming events are posted yet. Check back soon!</p>}
      </div>
    </section>

    {sermon && (
      <section class="section alt">
        <div class="wrap split">
          <div>
            <p class="eyebrow">Latest message</p>
            <h2>{sermon.title}</h2>
            <p class="muted">{[sermon.speaker, fmtDate(sermon.preached_on + 'T00:00', false), sermon.scripture].filter(Boolean).join(' · ')}</p>
            <p><a class="btn btn-outline" href={`/sermons/${sermon.id}`}>Watch or read notes</a></p>
          </div>
          <VideoEmbed url={sermon.video_url} title={sermon.title} />
        </div>
      </section>
    )}

    <section class="cta">
      <div class="wrap">
        <h2>Generosity changes lives.</h2>
        <p>Your giving supports missions, outreach, and ministry here in Jonesboro and around the world.</p>
        <a class="btn btn-gold" href="/give">Give Online</a>
      </div>
    </section>
  </>);
});

// ---------------------------------------------------------------- About
app.get('/about', async (c) => {
  const s = c.get('settings');
  const { results: staff } = await c.env.DB.prepare('SELECT * FROM staff ORDER BY sort_order, name').all<StaffRow>();
  return page(c, 'About Us', <>
    <PageHero title="About Us" lead={s.tagline} />
    <section class="section">
      <div class="wrap narrow">
        <Prose html={renderMarkdown(s.about_md)} />
        <h2 id="beliefs">What we believe</h2>
        <Prose html={renderMarkdown(s.beliefs_md)} />
      </div>
    </section>
    {staff.length > 0 && (
      <section class="section alt" id="staff">
        <div class="wrap">
          <h2>Our staff</h2>
          <div class="grid-4">
            {staff.map((p) => {
              const img = mediaUrl(p.photo_key);
              return (
                <div class="staff">
                  {img ? <img src={img} alt={p.name} loading="lazy" /> : <div class="avatar" aria-hidden="true">{p.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>}
                  <h3>{p.name}</h3>
                  <p class="eyebrow">{p.role}</p>
                  {p.bio && <p class="small">{p.bio}</p>}
                  {p.email && <p class="small"><a href={`mailto:${p.email}`}>{p.email}</a></p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    )}
  </>, 'Who we are, what we believe, and the people who serve at First Christian Church Jonesboro.');
});

// ---------------------------------------------------------------- Ministries
app.get('/ministries', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM ministries WHERE published = 1 ORDER BY sort_order, name').all<MinistryRow>();
  return page(c, 'Ministries', <>
    <PageHero title="Ministries" lead="There is a place for everyone at FCCJ, from newborns to grandparents." />
    <section class="section"><div class="wrap grid-3">{results.map((m) => <MinistryCard m={m} />)}</div></section>
  </>);
});

app.get('/ministries/:slug', async (c) => {
  const m = await c.env.DB.prepare('SELECT * FROM ministries WHERE slug = ? AND published = 1').bind(c.req.param('slug')).first<MinistryRow>();
  if (!m) return c.notFound();
  const img = mediaUrl(m.image_key);
  return page(c, m.name, <>
    <PageHero title={m.name} lead={m.summary} />
    <section class="section">
      <div class="wrap narrow">
        <p class="meta-row">{m.audience && <span><strong>Who:</strong> {m.audience}</span>}{m.schedule && <span><strong>When:</strong> {m.schedule}</span>}</p>
        {img && <img class="feature-img" src={img} alt="" />}
        <Prose html={renderMarkdown(m.body_md)} />
        {m.slug === 'wednesday-meal' && safeUrl(c.get('settings').meal_url) && (
          <p><a class="btn" href={safeUrl(c.get('settings').meal_url)!} target="_blank" rel="noopener noreferrer">Make a meal reservation</a></p>
        )}
        <p><a href="/contact">Questions? Contact us →</a></p>
      </div>
    </section>
  </>, m.summary);
});

// ---------------------------------------------------------------- Events
app.get('/events', async (c) => {
  const now = churchNow();
  const { results } = await c.env.DB.prepare('SELECT * FROM events WHERE published = 1 AND COALESCE(ends_at, starts_at) >= ? ORDER BY starts_at LIMIT 100').bind(now).all<EventRow>();
  const byMonth = new Map<string, EventRow[]>();
  for (const e of results) {
    const key = fmtDate(e.starts_at.slice(0, 7) + '-01', false).replace(/ 1,/, '');
    byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
  }
  return page(c, 'Events', <>
    <PageHero title="Events" lead="What is happening at First Christian Church Jonesboro." />
    <section class="section">
      <div class="wrap narrow">
        <p class="small muted">Add these to your calendar app: <a href="/events.ics">subscribe to the events feed</a>.</p>
        {results.length === 0 && <p>No upcoming events are posted right now.</p>}
        {[...byMonth.entries()].map(([month, list]) => (
          <div class="month">
            <h2>{month}</h2>
            <div class="event-list">{list.map((e) => <EventCard e={e} />)}</div>
          </div>
        ))}
      </div>
    </section>
  </>);
});

app.get('/events/:id{[0-9]+}', async (c) => {
  const e = await c.env.DB.prepare('SELECT * FROM events WHERE id = ? AND published = 1').bind(Number(c.req.param('id'))).first<EventRow>();
  if (!e) return c.notFound();
  const img = mediaUrl(e.image_key);
  const reg = safeUrl(e.registration_url);
  return page(c, e.title, <>
    <PageHero title={e.title} lead={fmtEventWhen(e.starts_at, e.ends_at, e.all_day)} />
    <section class="section">
      <div class="wrap narrow">
        {e.location && <p class="meta-row"><span><strong>Where:</strong> {e.location}</span></p>}
        {img && <img class="feature-img" src={img} alt="" />}
        {e.summary && <p class="lead dark">{e.summary}</p>}
        <Prose html={renderMarkdown(e.body_md)} />
        {reg && <p><a class="btn" href={reg} target="_blank" rel="noopener noreferrer">Register / RSVP</a></p>}
        <p><a href="/events">← All events</a></p>
      </div>
    </section>
  </>, e.summary);
});

app.get('/events.ics', async (c) => {
  const s = c.get('settings');
  const { results } = await c.env.DB.prepare("SELECT * FROM events WHERE published = 1 AND starts_at >= date('now', '-30 days') ORDER BY starts_at").all<EventRow>();
  const host = new URL(c.req.url).host;
  const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m);
  const dt = (local: string, allDay: number) => allDay ? `;VALUE=DATE:${local.slice(0, 10).replace(/-/g, '')}` : `;TZID=America/New_York:${local.replace(/[-:]/g, '')}00`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FCCJ//Events//EN', `X-WR-CALNAME:${esc(s.church_name ?? 'Events')}`, 'X-WR-TIMEZONE:America/New_York'];
  for (const e of results) {
    lines.push('BEGIN:VEVENT', `UID:event-${e.id}@${host}`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART${dt(e.starts_at, e.all_day)}`, ...(e.ends_at ? [`DTEND${dt(e.ends_at, e.all_day)}`] : []),
      `SUMMARY:${esc(e.title)}`, `LOCATION:${esc(e.location || `${s.address_street}, ${s.address_city}`)}`,
      `DESCRIPTION:${esc(e.summary)}`, `URL:https://${host}/events/${e.id}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return c.body(lines.join('\r\n'), 200, { 'Content-Type': 'text/calendar; charset=utf-8' });
});

// ---------------------------------------------------------------- Sermons
app.get('/sermons', async (c) => {
  const pageNo = Math.max(1, Math.min(1000, Number(c.req.query('page')) || 1));
  const per = 12;
  const { results } = await c.env.DB.prepare('SELECT * FROM sermons WHERE published = 1 ORDER BY preached_on DESC LIMIT ? OFFSET ?').bind(per + 1, (pageNo - 1) * per).all<SermonRow>();
  const more = results.length > per;
  const s = c.get('settings');
  const live = safeUrl(s.livestream_url);
  return page(c, 'Sermons', <>
    <PageHero title="Sermons" lead="Missed a Sunday? Catch up on recent messages." />
    <section class="section">
      <div class="wrap">
        {live && <p><a class="btn" href={live} target="_blank" rel="noopener noreferrer">Watch live on Sundays at {s.time_worship}</a></p>}
        {results.length === 0 && <p>Sermons will be posted here soon.</p>}
        <div class="grid-3">
          {results.slice(0, per).map((m) => {
            const id = youtubeId(m.video_url);
            return (
              <a class="card" href={`/sermons/${m.id}`}>
                {id && /^[\w-]{6,20}$/.test(id) ? <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" /> : <div class="card-art" aria-hidden="true">▶</div>}
                <div class="card-body">
                  <p class="eyebrow">{fmtDate(m.preached_on + 'T00:00', false)}{m.series ? ` · ${m.series}` : ''}</p>
                  <h3>{m.title}</h3>
                  <p class="muted small">{[m.speaker, m.scripture].filter(Boolean).join(' · ')}</p>
                </div>
              </a>
            );
          })}
        </div>
        <p class="pager">
          {pageNo > 1 && <a href={`/sermons?page=${pageNo - 1}`}>← Newer</a>}
          {more && <a href={`/sermons?page=${pageNo + 1}`}>Older →</a>}
        </p>
      </div>
    </section>
  </>);
});

app.get('/sermons/:id{[0-9]+}', async (c) => {
  const m = await c.env.DB.prepare('SELECT * FROM sermons WHERE id = ? AND published = 1').bind(Number(c.req.param('id'))).first<SermonRow>();
  if (!m) return c.notFound();
  return page(c, m.title, <>
    <PageHero title={m.title} lead={[m.speaker, fmtDate(m.preached_on + 'T00:00'), m.scripture].filter(Boolean).join(' · ')} />
    <section class="section">
      <div class="wrap narrow">
        {m.video_url && <VideoEmbed url={m.video_url} title={m.title} />}
        {m.notes_md && <><h2>Sermon notes</h2><Prose html={renderMarkdown(m.notes_md)} /></>}
        <p><a href="/sermons">← All sermons</a></p>
      </div>
    </section>
  </>);
});

// ---------------------------------------------------------------- Give
app.get('/give', (c) => {
  const s = c.get('settings');
  const url = safeUrl(s.give_url);
  return page(c, 'Give', <>
    <PageHero title="Give" lead="Thank you for your generosity." />
    <section class="section">
      <div class="wrap narrow">
        <p>{s.give_text}</p>
        {url ? <p><a class="btn btn-gold btn-lg" href={url} target="_blank" rel="noopener noreferrer">Give Online Securely</a></p>
             : <p class="muted">Online giving link coming soon. You can give during any Sunday service.</p>}
        <h2>Other ways to give</h2>
        <ul>
          <li><strong>In person</strong> during Sunday worship.</li>
          <li><strong>By mail</strong> to {s.church_name}, {s.address_street}, {s.address_city}.</li>
        </ul>
      </div>
    </section>
  </>);
});

// ---------------------------------------------------------------- Contact
function ContactPage({ c, sent, error, values }: { c: any; sent?: boolean; error?: string; values?: Record<string, string> }) {
  const s = c.get('settings');
  const v = values ?? {};
  const siteKey = c.env.TURNSTILE_SITE_KEY;
  return <>
    <PageHero title="Contact Us" lead="We would love to hear from you." />
    <section class="section">
      <div class="wrap split">
        <div>
          {sent ? <div class="notice success"><strong>Thank you!</strong> Your message was sent. Someone from our church office will get back to you soon.</div> : <>
            {error && <div class="notice error" role="alert">{error}</div>}
            <form method="post" action="/contact" class="form">
              <label>Your name<input name="name" required maxlength={100} autocomplete="name" value={v.name} /></label>
              <label>Email<input name="email" type="email" required maxlength={200} autocomplete="email" value={v.email} /></label>
              <label>Phone <span class="muted">(optional)</span><input name="phone" type="tel" maxlength={40} autocomplete="tel" value={v.phone} /></label>
              <label>How can we help?
                <select name="topic">
                  {['General question', 'Planning a visit', 'Prayer request', 'Kids & students', 'Baptism', 'Other'].map((t) => <option selected={v.topic === t}>{t}</option>)}
                </select>
              </label>
              <label>Message<textarea name="message" required maxlength={5000} rows={6}>{v.message}</textarea></label>
              <label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex={-1} autocomplete="off" /></label>
              {siteKey && <div class="cf-turnstile" data-sitekey={siteKey}></div>}
              <button class="btn" type="submit">Send message</button>
            </form>
            {siteKey && <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>}
          </>}
        </div>
        <div class="info-card">
          <h3>Church office</h3>
          <p>{s.address_street}<br />{s.address_city}</p>
          <p><a href={`tel:${(s.phone ?? '').replace(/[^\d+]/g, '')}`}>{s.phone}</a><br /><a href={`mailto:${s.email}`}>{s.email}</a></p>
          <h3>Sundays</h3>
          <p>{s.time_classes} Bible study<br />{s.time_worship} Worship</p>
        </div>
      </div>
    </section>
  </>;
}

app.get('/contact', (c) => page(c, 'Contact', <ContactPage c={c} sent={c.req.query('sent') === '1'} />));

app.post('/contact', async (c) => {
  if (!sameOrigin(c)) return c.text('Cross-site request blocked.', 403);
  const body = await c.req.parseBody();
  const str = (k: string, max: number) => (typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : '');
  const values = { name: str('name', 100), email: str('email', 200), phone: str('phone', 40), topic: str('topic', 60), message: str('message', 5000) };

  // Silently accept bot submissions caught by the honeypot so bots learn nothing.
  if (str('website', 200)) return c.redirect('/contact?sent=1', 303);

  const fail = (error: string) => page(c, 'Contact', <ContactPage c={c} error={error} values={values} />, undefined, 400);
  if (!values.name || !values.message) return fail('Please fill in your name and a message.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return fail('Please enter a valid email address.');

  if (c.env.TURNSTILE_SECRET) {
    const form = new FormData();
    form.append('secret', c.env.TURNSTILE_SECRET);
    form.append('response', str('cf-turnstile-response', 2048));
    form.append('remoteip', clientIp(c));
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const out = (await r.json()) as { success: boolean };
    if (!out.success) return fail('Please complete the spam check and try again.');
  }

  if (!(await rateLimit(c.env.DB, `contact:${clientIp(c)}`, 5, 3600))) {
    return fail('You have sent several messages recently. Please try again later or call the church office.');
  }

  await c.env.DB.prepare('INSERT INTO messages (name, email, phone, topic, body, ip) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(values.name, values.email, values.phone, values.topic, values.message, clientIp(c)).run();
  return c.redirect('/contact?sent=1', 303);
});

// ---------------------------------------------------------------- Custom pages
app.get('/p/:slug', async (c) => {
  const p = await c.env.DB.prepare('SELECT * FROM pages WHERE slug = ? AND published = 1').bind(c.req.param('slug')).first<PageRow>();
  if (!p) return c.notFound();
  const img = mediaUrl(p.image_key);
  return page(c, p.title, <>
    <PageHero title={p.title} lead={p.summary} />
    <section class="section">
      <div class="wrap narrow">
        {img && <img class="feature-img" src={img} alt="" />}
        <Prose html={renderMarkdown(p.body_md)} />
      </div>
    </section>
  </>, p.summary);
});

// Friendly redirects from the old site's URLs so existing links and search results keep working.
const LEGACY: Record<string, string> = {
  '/plan-a-visit': '/p/plan-a-visit', '/startingpoint': '/p/starting-point', '/lights': '/p/lights',
  '/about-us': '/about', '/beliefs-alternate': '/about#beliefs', '/contact-us': '/contact',
  '/children-s-ministry-alternate': '/ministries/kids', '/bible-study': '/ministries/adults',
  '/sunday-morning-services': '/p/plan-a-visit', '/calendar-alternate': '/events', '/sermon-notes': '/sermons',
};
for (const [from, to] of Object.entries(LEGACY)) app.get(from, (c) => c.redirect(to, 301));

// ---------------------------------------------------------------- Media, SEO
app.get('/media/:key', async (c) => {
  const obj = await c.env.MEDIA.get(c.req.param('key'));
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('ETag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  // Uploaded files are never rendered as documents on our origin.
  headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  if (!(headers.get('Content-Type') ?? '').startsWith('image/')) headers.set('Content-Disposition', 'attachment');
  return new Response(obj.body, { headers });
});

app.get('/robots.txt', (c) => c.text(`User-agent: *\nDisallow: /admin\nSitemap: ${new URL(c.req.url).origin}/sitemap.xml\n`));

app.get('/sitemap.xml', async (c) => {
  const origin = new URL(c.req.url).origin;
  const [pages, mins, evs, sers] = await Promise.all([
    c.env.DB.prepare('SELECT slug FROM pages WHERE published = 1').all<{ slug: string }>(),
    c.env.DB.prepare('SELECT slug FROM ministries WHERE published = 1').all<{ slug: string }>(),
    c.env.DB.prepare('SELECT id FROM events WHERE published = 1 AND starts_at >= ?').bind(churchNow()).all<{ id: number }>(),
    c.env.DB.prepare('SELECT id FROM sermons WHERE published = 1 ORDER BY preached_on DESC LIMIT 200').all<{ id: number }>(),
  ]);
  const urls = ['/', '/about', '/ministries', '/events', '/sermons', '/give', '/contact',
    ...pages.results.map((p) => `/p/${p.slug}`), ...mins.results.map((m) => `/ministries/${m.slug}`),
    ...evs.results.map((e) => `/events/${e.id}`), ...sers.results.map((s) => `/sermons/${s.id}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${origin}${encodeURI(u)}</loc></url>`).join('')}</urlset>`;
  return c.body(xml, 200, { 'Content-Type': 'application/xml' });
});

export default app;
