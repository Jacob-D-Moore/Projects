import { Hono } from 'hono';
import type { Context } from 'hono';
import qrcode from 'qrcode-generator';
import type { Env, EventRow, MediaRow, MessageRow } from '../types';
import { AdminLayout, Csrf } from './layout';
import { crud } from './crud';
import { clientIp, createSession, destroySession, readSession, requireAdmin, requireAuth, sameOrigin } from '../lib/auth';
import { audit, churchNow, clearRateLimit, rateLimit } from '../lib/db';
import { DUMMY_HASH, hashPassword, newTotpSecret, passwordProblems, randomToken, safeEqual, safeUrl, totpUri, verifyPassword, verifyTotp } from '../lib/security';
import { renderMarkdown } from '../lib/markdown';
import { storeUpload } from '../lib/media';
import { fmtEventWhen, mediaUrl } from '../lib/format';

const admin = new Hono<Env>();

// Admin pages must never be cached by browsers or proxies.
admin.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex, nofollow');
});

const bare = (c: Context<Env>, title: string, body: any, status = 200) => c.html(<AdminLayout title={title}>{body}</AdminLayout>, status as any);

function safeNext(n: string | undefined): string {
  return n && /^\/admin(\/[\w\-/]*)?$/.test(n) ? n : '/admin';
}

async function userCount(c: Context<Env>) {
  return (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n ?? 0;
}

// ============================================================ First-run setup
function SetupForm({ token, error }: { token: string; error?: string }) {
  return <>
    <p>Create the first administrator account.</p>
    {error && <div class="notice error" role="alert">{error}</div>}
    <form method="post" action="/admin/setup" class="form">
      <input type="hidden" name="token" value={token} />
      <label>Your name<input name="name" required maxlength={100} autocomplete="name" /></label>
      <label>Email<input name="email" type="email" required maxlength={200} autocomplete="username" /></label>
      <label>Password<small class="help">At least 12 characters. A short phrase of unrelated words is strong and easy to remember.</small>
        <input name="password" type="password" required minlength={12} autocomplete="new-password" /></label>
      <button class="btn" type="submit">Create account</button>
    </form>
  </>;
}

admin.get('/setup', async (c) => {
  if (!c.env.SETUP_TOKEN) return bare(c, 'Setup disabled', <p>Set the <code>SETUP_TOKEN</code> secret to enable first-time setup.</p>, 403);
  if ((await userCount(c)) > 0) return c.redirect('/admin/login');
  const token = c.req.query('token') ?? '';
  if (!safeEqual(token, c.env.SETUP_TOKEN)) return bare(c, 'Setup', <p>Open the setup link that includes your setup token.</p>, 403);
  return bare(c, 'Welcome!', <SetupForm token={token} />);
});

admin.post('/setup', async (c) => {
  if (!sameOrigin(c)) return c.text('Cross-site request blocked.', 403);
  if (!c.env.SETUP_TOKEN || (await userCount(c)) > 0) return c.redirect('/admin/login');
  if (!(await rateLimit(c.env.DB, `setup:${clientIp(c)}`, 10, 3600))) return c.text('Too many attempts.', 429);
  const b = await c.req.parseBody();
  const token = String(b.token ?? '');
  if (!safeEqual(token, c.env.SETUP_TOKEN)) return c.text('Invalid setup token.', 403);
  const name = String(b.name ?? '').trim().slice(0, 100);
  const email = String(b.email ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(b.password ?? '');
  const problem = !name ? 'Please enter your name.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Please enter a valid email.' : passwordProblems(password);
  if (problem) return bare(c, 'Welcome!', <SetupForm token={token} error={problem} />, 400);
  const res = await c.env.DB.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .bind(email, name, await hashPassword(password)).run();
  await audit(c.env, res.meta.last_row_id, 'setup', 'first admin created', clientIp(c));
  await createSession(c, res.meta.last_row_id, false);
  return c.redirect('/admin/account?m=welcome', 303);
});

// ============================================================ Login
function LoginForm({ error, next, email }: { error?: string; next: string; email?: string }) {
  return <>
    {error && <div class="notice error" role="alert">{error}</div>}
    <form method="post" action={`/admin/login?next=${encodeURIComponent(next)}`} class="form">
      <label>Email<input name="email" type="email" required autocomplete="username" value={email} autofocus /></label>
      <label>Password<input name="password" type="password" required autocomplete="current-password" /></label>
      <button class="btn" type="submit">Sign in</button>
    </form>
    <p class="muted small">Forgot your password? Ask a site administrator to reset it.</p>
  </>;
}

admin.get('/login', async (c) => {
  const found = await readSession(c);
  if (found && !found.session.mfa_pending) return c.redirect(safeNext(c.req.query('next')));
  if ((await userCount(c)) === 0) return bare(c, 'Not set up yet', <p>No accounts exist yet. Use the setup link from the installation guide.</p>);
  return bare(c, 'Staff sign in', <LoginForm next={safeNext(c.req.query('next'))} />);
});

admin.post('/login', async (c) => {
  if (!sameOrigin(c)) return c.text('Cross-site request blocked.', 403);
  const next = safeNext(c.req.query('next'));
  const b = await c.req.parseBody();
  const email = String(b.email ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(b.password ?? '').slice(0, 256);
  const ip = clientIp(c);
  const fail = (msg = 'That email and password combination is not correct.') =>
    bare(c, 'Staff sign in', <LoginForm error={msg} next={next} email={email} />, 401);

  const ipOk = await rateLimit(c.env.DB, `login-ip:${ip}`, 20, 15 * 60);
  const acctOk = await rateLimit(c.env.DB, `login-acct:${email}`, 5, 15 * 60);
  if (!ipOk || !acctOk) {
    await audit(c.env, null, 'login throttled', email, ip);
    return fail('Too many sign-in attempts. Please wait 15 minutes and try again.');
  }

  const user = await c.env.DB.prepare('SELECT id, password_hash, totp_enabled, disabled FROM users WHERE email = ?').bind(email)
    .first<{ id: number; password_hash: string; totp_enabled: number; disabled: number }>();
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok || user.disabled) {
    await audit(c.env, user?.id ?? null, 'login failed', email, ip);
    return fail();
  }
  await clearRateLimit(c.env.DB, `login-acct:${email}`);
  await destroySession(c); // never reuse a pre-login session id
  if (user.totp_enabled) {
    await createSession(c, user.id, true);
    return c.redirect(`/admin/login/2fa?next=${encodeURIComponent(next)}`, 303);
  }
  await createSession(c, user.id, false);
  await c.env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(user.id).run();
  await audit(c.env, user.id, 'login', '', ip);
  return c.redirect(next, 303);
});

function TwoFactorForm({ next, error }: { next: string; error?: string }) {
  return <>
    <p>Enter the 6-digit code from your authenticator app.</p>
    {error && <div class="notice error" role="alert">{error}</div>}
    <form method="post" action={`/admin/login/2fa?next=${encodeURIComponent(next)}`} class="form">
      <label>Code<input name="code" inputmode="numeric" pattern="[0-9 ]{6,7}" maxlength={7} autocomplete="one-time-code" required autofocus /></label>
      <button class="btn" type="submit">Verify</button>
    </form>
  </>;
}

admin.get('/login/2fa', async (c) => {
  const found = await readSession(c);
  if (!found?.session.mfa_pending) return c.redirect('/admin/login');
  return bare(c, 'Two-step verification', <TwoFactorForm next={safeNext(c.req.query('next'))} />);
});

admin.post('/login/2fa', async (c) => {
  if (!sameOrigin(c)) return c.text('Cross-site request blocked.', 403);
  const found = await readSession(c);
  if (!found?.session.mfa_pending) return c.redirect('/admin/login');
  const next = safeNext(c.req.query('next'));
  const uid = found.user.id;
  if (!(await rateLimit(c.env.DB, `2fa:${uid}`, 5, 5 * 60))) {
    await destroySession(c);
    await audit(c.env, uid, '2fa throttled', '', clientIp(c));
    return bare(c, 'Two-step verification', <div class="notice error">Too many incorrect codes. Please wait a few minutes, then <a href="/admin/login">sign in again</a>.</div>, 429);
  }
  const u = await c.env.DB.prepare('SELECT totp_secret, totp_last_step FROM users WHERE id = ?').bind(uid).first<{ totp_secret: string; totp_last_step: number }>();
  const step = u?.totp_secret ? await verifyTotp(u.totp_secret, String((await c.req.parseBody()).code ?? ''), u.totp_last_step) : null;
  if (step === null) {
    await audit(c.env, uid, '2fa failed', '', clientIp(c));
    return bare(c, 'Two-step verification', <TwoFactorForm next={next} error="That code is not correct. Codes change every 30 seconds." />, 401);
  }
  await c.env.DB.prepare("UPDATE users SET totp_last_step = ?, last_login_at = datetime('now') WHERE id = ?").bind(step, uid).run();
  await clearRateLimit(c.env.DB, `2fa:${uid}`);
  await destroySession(c);
  await createSession(c, uid, false);
  await audit(c.env, uid, 'login', 'with 2FA', clientIp(c));
  return c.redirect(next, 303);
});

// ============================================================ Everything below requires sign-in
admin.use('*', requireAuth);

admin.post('/logout', async (c) => {
  await audit(c.env, c.get('user').id, 'logout', '', clientIp(c));
  await destroySession(c);
  return c.redirect('/admin/login', 303);
});

async function unreadCount(c: Context<Env>) {
  return (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0').first<{ n: number }>())?.n ?? 0;
}

function view(c: Context<Env>, title: string, body: any, opts: { flash?: string; unread?: number; status?: number } = {}) {
  return c.html(
    <AdminLayout title={title} user={c.get('user')} csrf={c.get('session').csrf_token} path={new URL(c.req.url).pathname} flash={opts.flash} unread={opts.unread}>
      {body}
    </AdminLayout>,
    (opts.status ?? 200) as any
  );
}

// ============================================================ Dashboard
admin.get('/', async (c) => {
  const [unread, upcoming, counts] = await Promise.all([
    unreadCount(c),
    c.env.DB.prepare('SELECT * FROM events WHERE published = 1 AND starts_at >= ? ORDER BY starts_at LIMIT 5').bind(churchNow()).all<EventRow>(),
    c.env.DB.prepare('SELECT (SELECT COUNT(*) FROM sermons) AS sermons, (SELECT COUNT(*) FROM pages) AS pages, (SELECT COUNT(*) FROM events) AS events').first<{ sermons: number; pages: number; events: number }>(),
  ]);
  const s = c.get('settings');
  return view(c, `Hi, ${c.get('user').name.split(' ')[0]}!`, <>
    {!c.get('user').totp_enabled && <div class="notice warn">Protect your account: <a href="/admin/account">turn on two-step verification</a>.</div>}
    <div class="tiles">
      <a class="tile" href="/admin/messages"><strong>{unread}</strong><span>unread messages</span></a>
      <a class="tile" href="/admin/events"><strong>{upcoming.results.length}</strong><span>upcoming events</span></a>
      <a class="tile" href="/admin/sermons"><strong>{counts?.sermons ?? 0}</strong><span>sermons posted</span></a>
      <a class="tile" href="/admin/settings#alert"><strong>{s.alert_enabled === '1' ? 'On' : 'Off'}</strong><span>announcement banner</span></a>
    </div>
    <h2>Quick actions</h2>
    <p class="quick">
      <a class="btn" href="/admin/sermons/new">+ Post a sermon</a>
      <a class="btn" href="/admin/events/new">+ Add an event</a>
      <a class="btn btn-outline" href="/admin/settings#alert">Post an announcement banner</a>
      <a class="btn btn-outline" href="/admin/media">Upload photos</a>
    </p>
    <h2>Next up on the calendar</h2>
    {upcoming.results.length === 0 ? <p class="empty">No upcoming events. <a href="/admin/events/new">Add one</a>.</p> : (
      <ul class="rows">{upcoming.results.map((e) => <li><a href={`/admin/events/${e.id}`}><strong>{e.title}</strong><br /><span class="muted small">{fmtEventWhen(e.starts_at, e.ends_at, e.all_day)}</span></a></li>)}</ul>
    )}
  </>, { unread });
});

// ============================================================ Markdown preview
admin.post('/preview', async (c) => {
  const b = await c.req.parseBody();
  return c.html(renderMarkdown(String(b.md ?? '').slice(0, 50000)));
});

// ============================================================ Site settings
type SettingField = { key: string; label: string; type?: 'text' | 'textarea' | 'markdown' | 'url' | 'checkbox' | 'image' | 'email'; help?: string };
const SETTINGS_GROUPS: { id: string; title: string; fields: SettingField[] }[] = [
  { id: 'alert', title: 'Announcement banner', fields: [
    { key: 'alert_enabled', label: 'Show the announcement banner at the top of every page', type: 'checkbox' },
    { key: 'alert_text', label: 'Banner text', help: 'e.g. "Services are cancelled this Sunday due to weather."' },
    { key: 'alert_link', label: 'Banner link (optional)', type: 'url' },
  ]},
  { id: 'church', title: 'Church information', fields: [
    { key: 'church_name', label: 'Church name' },
    { key: 'short_name', label: 'Short name', help: 'Shown in the logo, e.g. FCCJ.' },
    { key: 'tagline', label: 'Tagline' },
    { key: 'address_street', label: 'Street address' },
    { key: 'address_city', label: 'City, state, ZIP' },
    { key: 'address_note', label: 'Directions note' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Office email', type: 'email' },
  ]},
  { id: 'times', title: 'Sunday times', fields: [
    { key: 'time_classes', label: 'Bible study classes time' },
    { key: 'time_worship', label: 'Worship service time' },
  ]},
  { id: 'home', title: 'Home page', fields: [
    { key: 'hero_heading', label: 'Big headline' },
    { key: 'hero_subheading', label: 'Welcome text', type: 'textarea' },
    { key: 'hero_image_key', label: 'Background photo', type: 'image', help: 'A wide photo works best (at least 1600 pixels across).' },
  ]},
  { id: 'links', title: 'Links & online services', fields: [
    { key: 'give_url', label: 'Online giving link', type: 'url', help: 'e.g. your Planning Center / Church Center giving page.' },
    { key: 'give_text', label: 'Giving page message', type: 'textarea' },
    { key: 'meal_url', label: 'Wednesday meal reservation link', type: 'url' },
    { key: 'livestream_url', label: 'Livestream link', type: 'url' },
    { key: 'facebook_url', label: 'Facebook page', type: 'url' },
    { key: 'youtube_url', label: 'YouTube channel', type: 'url' },
    { key: 'instagram_url', label: 'Instagram', type: 'url' },
  ]},
  { id: 'about', title: 'About page', fields: [
    { key: 'about_md', label: 'Who we are', type: 'markdown' },
    { key: 'beliefs_md', label: 'What we believe', type: 'markdown' },
  ]},
];

async function settingsPage(c: Context<Env>, flash?: string, error?: string) {
  const s = c.get('settings');
  const { results: media } = await c.env.DB.prepare("SELECT * FROM media WHERE content_type LIKE 'image/%' ORDER BY id DESC LIMIT 200").all<MediaRow>();
  const csrf = c.get('session').csrf_token;
  return view(c, 'Site Settings', <>
    {error && <div class="notice error" role="alert">{error}</div>}
    <nav class="jump">{SETTINGS_GROUPS.map((g) => <a href={`#${g.id}`}>{g.title}</a>)}</nav>
    <form method="post" action="/admin/settings" enctype="multipart/form-data" class="form">
      <Csrf token={csrf} />
      {SETTINGS_GROUPS.map((g) => (
        <section class="panel" id={g.id}>
          <h2>{g.title}</h2>
          {g.fields.map((f) => {
            const v = s[f.key] ?? '';
            const help = f.help && <small class="help">{f.help}</small>;
            if (f.type === 'checkbox') return <><input type="hidden" name={f.key} value="0" /><label class="check"><input type="checkbox" name={f.key} value="1" checked={v === '1'} /> {f.label}</label></>;
            if (f.type === 'textarea') return <label>{f.label}{help}<textarea name={f.key} rows={3}>{v}</textarea></label>;
            if (f.type === 'markdown') return (
              <div class="md-field">
                <label for={`s-${f.key}`}>{f.label}</label>
                <div class="md-toolbar" data-for={`s-${f.key}`}>
                  <button type="button" data-md="bold"><b>B</b></button><button type="button" data-md="italic"><i>I</i></button>
                  <button type="button" data-md="h2">H</button><button type="button" data-md="list">• List</button>
                  <button type="button" data-md="link">Link</button><button type="button" data-md="preview" class="right">Preview</button>
                </div>
                <textarea id={`s-${f.key}`} name={f.key} rows={10} class="mono">{v}</textarea>
                <div class="md-preview prose" hidden></div>
              </div>
            );
            if (f.type === 'image') return (
              <fieldset class="image-field"><legend>{f.label}</legend>{help}
                {mediaUrl(v) && <img src={mediaUrl(v)!} alt="" class="thumb" />}
                <label>Choose an existing image<select name={f.key}><option value="">None</option>{media.map((m) => <option value={m.key} selected={m.key === v}>{m.filename}</option>)}</select></label>
                <label>…or upload a new one<input type="file" name={`${f.key}__upload`} accept="image/jpeg,image/png,image/webp,image/gif" /></label>
              </fieldset>
            );
            return <label>{f.label}{help}<input type={f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : 'text'} name={f.key} value={v} maxlength={500} /></label>;
          })}
        </section>
      ))}
      <div class="form-actions sticky"><button class="btn" type="submit">Save all settings</button></div>
    </form>
  </>, { flash, status: error ? 400 : 200 });
}

admin.get('/settings', (c) => settingsPage(c, c.req.query('m') === 'saved' ? 'Settings saved. Changes are live on the website now.' : undefined));

admin.post('/settings', async (c) => {
  const b = await c.req.parseBody({ all: true });
  // Checkboxes send a hidden '0' plus '1' when ticked; keep the last value for each key.
  for (const [k, v] of Object.entries(b)) if (Array.isArray(v)) b[k] = v[v.length - 1];
  const stmts: D1PreparedStatement[] = [];
  for (const g of SETTINGS_GROUPS) for (const f of g.fields) {
    // Only touch settings that were actually submitted, so a partial form can never blank the rest.
    if (!(f.key in b) && !(`${f.key}__upload` in b)) continue;
    let v: string;
    if (f.type === 'checkbox') v = b[f.key] === '1' ? '1' : '0';
    else if (f.type === 'image') {
      v = typeof b[f.key] === 'string' ? (b[f.key] as string) : '';
      const up = b[`${f.key}__upload`];
      if (up instanceof File && up.size > 0) {
        const r = await storeUpload(c.env, up, c.get('user').id, true);
        if (!r.ok) return settingsPage(c, undefined, r.error);
        v = r.key;
      }
    } else {
      v = typeof b[f.key] === 'string' ? (b[f.key] as string).trim().slice(0, f.type === 'markdown' ? 20000 : 1000) : '';
      if (f.type === 'url' && v && !safeUrl(v)) return settingsPage(c, undefined, `"${f.label}" must be a full link starting with https://`);
    }
    stmts.push(c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(f.key, v));
  }
  await c.env.DB.batch(stmts);
  await audit(c.env, c.get('user').id, 'update settings', '', clientIp(c));
  return c.redirect('/admin/settings?m=saved', 303);
});

// ============================================================ Messages
admin.get('/messages', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 200').all<MessageRow>();
  return view(c, 'Messages', <>
    <p class="muted">Messages sent through the website contact form.</p>
    {results.length === 0 ? <p class="empty">No messages yet.</p> : (
      <ul class="rows">
        {results.map((m) => (
          <li class={m.is_read ? '' : 'unread'}>
            <a href={`/admin/messages/${m.id}`}><strong>{m.name}</strong> · {m.topic} {!m.is_read && <span class="tag">New</span>}<br />
              <span class="muted small">{m.created_at} UTC · {m.body.slice(0, 90)}{m.body.length > 90 ? '…' : ''}</span></a>
          </li>
        ))}
      </ul>
    )}
  </>, { unread: results.filter((m) => !m.is_read).length, flash: c.req.query('m') === 'deleted' ? 'Message deleted.' : undefined });
});

admin.get('/messages/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  const m = await c.env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first<MessageRow>();
  if (!m) return c.notFound();
  if (!m.is_read) await c.env.DB.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(id).run();
  const csrf = c.get('session').csrf_token;
  return view(c, `Message from ${m.name}`, <>
    <p><a href="/admin/messages">← All messages</a></p>
    <dl class="kv">
      <dt>Topic</dt><dd>{m.topic}</dd>
      <dt>Email</dt><dd><a href={`mailto:${m.email}`}>{m.email}</a></dd>
      {m.phone && <><dt>Phone</dt><dd><a href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}>{m.phone}</a></dd></>}
      <dt>Received</dt><dd>{m.created_at} UTC</dd>
    </dl>
    <div class="message-body">{m.body}</div>
    <p class="quick">
      <a class="btn" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + m.topic)}`}>Reply by email</a>
    </p>
    <form method="post" action={`/admin/messages/${m.id}/delete`} data-confirm="Delete this message?" class="danger-zone">
      <Csrf token={csrf} /><button class="btn btn-danger" type="submit">Delete message</button>
    </form>
  </>);
});

admin.post('/messages/:id{[0-9]+}/delete', async (c) => {
  await c.env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(Number(c.req.param('id'))).run();
  await audit(c.env, c.get('user').id, 'delete message', `#${c.req.param('id')}`, clientIp(c));
  return c.redirect('/admin/messages?m=deleted', 303);
});

// ============================================================ Media library
admin.get('/media', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM media ORDER BY id DESC LIMIT 300').all<MediaRow>();
  const csrf = c.get('session').csrf_token;
  const msg = { up: 'Uploaded.', del: 'Deleted.' }[c.req.query('m') ?? ''];
  const err = c.req.query('err');
  return view(c, 'Images & Files', <>
    {err && <div class="notice error" role="alert">{err.slice(0, 200)}</div>}
    <form method="post" action="/admin/media" enctype="multipart/form-data" class="form upload">
      <Csrf token={csrf} />
      <label>Upload photos or PDFs (up to 10 MB each)<input type="file" name="files" multiple required accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" /></label>
      <button class="btn" type="submit">Upload</button>
    </form>
    <p class="muted small">To use a file in a page or sermon notes, copy its link and paste it in. Images: <code>![description](link)</code>. PDFs: <code>[Bulletin](link)</code>.</p>
    <div class="media-grid">
      {results.map((m) => (
        <figure>
          {m.content_type.startsWith('image/') ? <img src={mediaUrl(m.key)!} alt="" loading="lazy" /> : <div class="file-icon">PDF</div>}
          <figcaption>
            <span title={m.filename}>{m.filename}</span>
            <span class="muted small">{Math.ceil(m.size / 1024)} KB</span>
            <input class="copy" readonly value={mediaUrl(m.key)!} aria-label="File link" />
            <form method="post" action={`/admin/media/${m.id}/delete`} data-confirm="Delete this file? Any page using it will show a broken image.">
              <Csrf token={csrf} /><button class="linkish danger" type="submit">Delete</button>
            </form>
          </figcaption>
        </figure>
      ))}
    </div>
  </>, { flash: msg });
});

admin.post('/media', async (c) => {
  const b = await c.req.parseBody({ all: true });
  const files = ([] as unknown[]).concat(b.files ?? []).filter((f): f is File => f instanceof File && f.size > 0).slice(0, 20);
  for (const f of files) {
    const r = await storeUpload(c.env, f, c.get('user').id);
    if (!r.ok) return c.redirect(`/admin/media?err=${encodeURIComponent(`${f.name}: ${r.error}`)}`, 303);
  }
  await audit(c.env, c.get('user').id, 'upload media', `${files.length} file(s)`, clientIp(c));
  return c.redirect('/admin/media?m=up', 303);
});

admin.post('/media/:id{[0-9]+}/delete', async (c) => {
  const m = await c.env.DB.prepare('SELECT key FROM media WHERE id = ?').bind(Number(c.req.param('id'))).first<{ key: string }>();
  if (m) {
    await c.env.MEDIA.delete(m.key);
    await c.env.DB.prepare('DELETE FROM media WHERE id = ?').bind(Number(c.req.param('id'))).run();
    await audit(c.env, c.get('user').id, 'delete media', m.key, clientIp(c));
  }
  return c.redirect('/admin/media?m=del', 303);
});

// ============================================================ My account (password + 2FA)
admin.get('/account', async (c) => {
  const u = c.get('user');
  const csrf = c.get('session').csrf_token;
  const msgs: Record<string, string> = { welcome: 'Your account is ready. We strongly recommend turning on two-step verification below.', pw: 'Password changed. Other devices were signed out.', '2fa-on': 'Two-step verification is on.', '2fa-off': 'Two-step verification turned off.', out: 'All other devices were signed out.' };
  const err = c.req.query('err');
  const row = await c.env.DB.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?').bind(u.id).first<{ totp_secret: string | null; totp_enabled: number }>();

  let setup: any = null;
  if (!row?.totp_enabled) {
    let secret = row?.totp_secret;
    if (!secret) {
      secret = newTotpSecret();
      await c.env.DB.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').bind(secret, u.id).run();
    }
    const qr = qrcode(0, 'M');
    qr.addData(totpUri(secret, u.email, c.get('settings').short_name || 'FCCJ'));
    qr.make();
    setup = (
      <>
        <p>1. Install an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, etc.).<br />2. Scan this code with the app.<br />3. Type the 6-digit code it shows to finish.</p>
        <div class="qr" dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) }} />
        <p class="small muted">Can't scan? Enter this key manually: <code>{secret.match(/.{1,4}/g)!.join(' ')}</code></p>
        <form method="post" action="/admin/account/2fa" class="form inline">
          <Csrf token={csrf} />
          <label>6-digit code<input name="code" inputmode="numeric" pattern="[0-9 ]{6,7}" maxlength={7} autocomplete="one-time-code" required /></label>
          <button class="btn" type="submit">Turn on</button>
        </form>
      </>
    );
  }

  return view(c, 'My Account', <>
    {err && <div class="notice error" role="alert">{err.slice(0, 200)}</div>}
    <section class="panel">
      <h2>Two-step verification</h2>
      {row?.totp_enabled ? <>
        <p><span class="tag ok">On</span> Signing in requires a code from your authenticator app.</p>
        <form method="post" action="/admin/account/2fa/off" class="form inline" data-confirm="Turn off two-step verification? Your account will be less secure.">
          <Csrf token={csrf} />
          <label>Confirm your password<input name="password" type="password" required autocomplete="current-password" /></label>
          <button class="btn btn-outline" type="submit">Turn off</button>
        </form>
      </> : setup}
    </section>
    <section class="panel">
      <h2>Change password</h2>
      <form method="post" action="/admin/account/password" class="form">
        <Csrf token={csrf} />
        <input type="hidden" name="username" value={u.email} autocomplete="username" />
        <label>Current password<input name="current" type="password" required autocomplete="current-password" /></label>
        <label>New password<small class="help">At least 12 characters.</small><input name="password" type="password" required minlength={12} autocomplete="new-password" /></label>
        <button class="btn" type="submit">Change password</button>
      </form>
    </section>
    <section class="panel">
      <h2>Sessions</h2>
      <form method="post" action="/admin/account/signout-others"><Csrf token={csrf} /><button class="btn btn-outline" type="submit">Sign out all other devices</button></form>
    </section>
  </>, { flash: msgs[c.req.query('m') ?? ''] });
});

admin.post('/account/password', async (c) => {
  const u = c.get('user');
  const b = await c.req.parseBody();
  if (!(await rateLimit(c.env.DB, `pwchange:${u.id}`, 5, 15 * 60))) return c.redirect('/admin/account?err=' + encodeURIComponent('Too many attempts. Try again later.'), 303);
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(u.id).first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(String(b.current ?? ''), row.password_hash))) return c.redirect('/admin/account?err=' + encodeURIComponent('Your current password is not correct.'), 303);
  const pw = String(b.password ?? '');
  const problem = passwordProblems(pw);
  if (problem) return c.redirect('/admin/account?err=' + encodeURIComponent(problem), 303);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(pw), u.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').bind(u.id, c.get('session').id_hash),
  ]);
  await audit(c.env, u.id, 'change password', '', clientIp(c));
  return c.redirect('/admin/account?m=pw', 303);
});

admin.post('/account/2fa', async (c) => {
  const u = c.get('user');
  if (!(await rateLimit(c.env.DB, `2fa-setup:${u.id}`, 10, 15 * 60))) return c.redirect('/admin/account?err=' + encodeURIComponent('Too many attempts. Try again later.'), 303);
  const row = await c.env.DB.prepare('SELECT totp_secret FROM users WHERE id = ?').bind(u.id).first<{ totp_secret: string | null }>();
  const step = row?.totp_secret ? await verifyTotp(row.totp_secret, String((await c.req.parseBody()).code ?? ''), 0) : null;
  if (step === null) return c.redirect('/admin/account?err=' + encodeURIComponent('That code did not match. Check that your phone’s clock is correct and try again.'), 303);
  await c.env.DB.prepare('UPDATE users SET totp_enabled = 1, totp_last_step = ? WHERE id = ?').bind(step, u.id).run();
  await audit(c.env, u.id, 'enable 2fa', '', clientIp(c));
  return c.redirect('/admin/account?m=2fa-on', 303);
});

admin.post('/account/2fa/off', async (c) => {
  const u = c.get('user');
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(u.id).first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(String((await c.req.parseBody()).password ?? ''), row.password_hash))) return c.redirect('/admin/account?err=' + encodeURIComponent('Password is not correct.'), 303);
  await c.env.DB.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_last_step = 0 WHERE id = ?').bind(u.id).run();
  await audit(c.env, u.id, 'disable 2fa', '', clientIp(c));
  return c.redirect('/admin/account?m=2fa-off', 303);
});

admin.post('/account/signout-others', async (c) => {
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').bind(c.get('user').id, c.get('session').id_hash).run();
  return c.redirect('/admin/account?m=out', 303);
});

// ============================================================ Users (admins only)
type UserRow = { id: number; email: string; name: string; role: string; totp_enabled: number; disabled: number; last_login_at: string | null };

async function usersPage(c: Context<Env>, temp?: string, err?: string) {
  const { results } = await c.env.DB.prepare('SELECT id, email, name, role, totp_enabled, disabled, last_login_at FROM users ORDER BY name').all<UserRow>();
  const csrf = c.get('session').csrf_token;
  return view(c, 'Users', <>
    {temp && <div class="notice warn"><strong>Temporary password:</strong> <code>{temp}</code><br />Share it with the person privately (in person or by phone, not in a group chat). They should change it after signing in. It will not be shown again.</div>}
    {err && <div class="notice error" role="alert">{err.slice(0, 200)}</div>}
    <p class="muted"><strong>Editors</strong> can update all website content. <strong>Admins</strong> can also manage users and view the activity log.</p>
    <table class="table">
      <thead><tr><th>Name</th><th>Role</th><th>2-step</th><th>Last sign-in</th><th></th></tr></thead>
      <tbody>
        {results.map((u) => (
          <tr class={u.disabled ? 'disabled' : ''}>
            <td><strong>{u.name}</strong><br /><span class="muted small">{u.email}</span></td>
            <td>{u.role}{u.disabled ? ' (disabled)' : ''}</td>
            <td>{u.totp_enabled ? 'On' : 'Off'}</td>
            <td class="small">{u.last_login_at ?? 'Never'}</td>
            <td class="actions-cell">
              {u.id !== c.get('user').id && <>
                <form method="post" action={`/admin/users/${u.id}/role`}><Csrf token={csrf} /><input type="hidden" name="role" value={u.role === 'admin' ? 'editor' : 'admin'} /><button class="linkish" type="submit">Make {u.role === 'admin' ? 'editor' : 'admin'}</button></form>
                <form method="post" action={`/admin/users/${u.id}/reset`} data-confirm={`Reset ${u.name}'s password and sign them out everywhere?`}><Csrf token={csrf} /><button class="linkish" type="submit">Reset password</button></form>
                <form method="post" action={`/admin/users/${u.id}/toggle`}><Csrf token={csrf} /><button class="linkish danger" type="submit">{u.disabled ? 'Enable' : 'Disable'}</button></form>
              </>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <section class="panel">
      <h2>Add a user</h2>
      <form method="post" action="/admin/users" class="form">
        <Csrf token={csrf} />
        <label>Name<input name="name" required maxlength={100} /></label>
        <label>Email<input name="email" type="email" required maxlength={200} /></label>
        <label>Role<select name="role"><option value="editor">Editor</option><option value="admin">Admin</option></select></label>
        <button class="btn" type="submit">Create user</button>
      </form>
    </section>
  </>);
}

admin.get('/users', requireAdmin, (c) => usersPage(c, undefined, c.req.query('err')));

function tempPassword() {
  return randomToken(12); // 16 url-safe characters, about 96 bits of randomness
}

admin.post('/users', requireAdmin, async (c) => {
  const b = await c.req.parseBody();
  const name = String(b.name ?? '').trim().slice(0, 100);
  const email = String(b.email ?? '').trim().toLowerCase().slice(0, 200);
  const role = b.role === 'admin' ? 'admin' : 'editor';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.redirect('/admin/users?err=' + encodeURIComponent('Enter a name and a valid email.'), 303);
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) return c.redirect('/admin/users?err=' + encodeURIComponent('A user with that email already exists.'), 303);
  const pw = tempPassword();
  await c.env.DB.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').bind(email, name, await hashPassword(pw), role).run();
  await audit(c.env, c.get('user').id, 'create user', `${email} (${role})`, clientIp(c));
  // Shown once, in the response body only (never in a URL, log, or database).
  return usersPage(c, pw);
});

async function otherAdmins(c: Context<Env>, excludeId: number) {
  return (await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0 AND id != ?").bind(excludeId).first<{ n: number }>())?.n ?? 0;
}

admin.post('/users/:id{[0-9]+}/role', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (id === c.get('user').id) return c.redirect('/admin/users', 303);
  const role = (await c.req.parseBody()).role === 'admin' ? 'admin' : 'editor';
  if (role === 'editor' && (await otherAdmins(c, id)) === 0) return c.redirect('/admin/users?err=' + encodeURIComponent('There must always be at least one admin.'), 303);
  await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
  await audit(c.env, c.get('user').id, 'change role', `#${id} -> ${role}`, clientIp(c));
  return c.redirect('/admin/users', 303);
});

admin.post('/users/:id{[0-9]+}/reset', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (id === c.get('user').id) return c.redirect('/admin/users', 303);
  const pw = tempPassword();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ?, totp_enabled = 0, totp_secret = NULL, totp_last_step = 0 WHERE id = ?').bind(await hashPassword(pw), id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
  ]);
  await audit(c.env, c.get('user').id, 'reset password', `#${id}`, clientIp(c));
  return usersPage(c, pw);
});

admin.post('/users/:id{[0-9]+}/toggle', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (id === c.get('user').id) return c.redirect('/admin/users', 303);
  const u = await c.env.DB.prepare('SELECT role, disabled FROM users WHERE id = ?').bind(id).first<{ role: string; disabled: number }>();
  if (!u) return c.notFound();
  if (!u.disabled && u.role === 'admin' && (await otherAdmins(c, id)) === 0) return c.redirect('/admin/users?err=' + encodeURIComponent('There must always be at least one admin.'), 303);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET disabled = ? WHERE id = ?').bind(u.disabled ? 0 : 1, id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
  ]);
  await audit(c.env, c.get('user').id, u.disabled ? 'enable user' : 'disable user', `#${id}`, clientIp(c));
  return c.redirect('/admin/users', 303);
});

// ============================================================ Activity log (admins only)
admin.get('/audit', requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300'
  ).all<{ id: number; user_name: string | null; action: string; detail: string; ip: string | null; created_at: string }>();
  return view(c, 'Activity Log', <>
    <p class="muted">The last 300 sign-ins and changes, newest first. Times are UTC.</p>
    <table class="table">
      <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th><th>IP</th></tr></thead>
      <tbody>{results.map((a) => <tr class={a.action.includes('fail') || a.action.includes('throttled') ? 'warn' : ''}><td class="small">{a.created_at}</td><td>{a.user_name ?? '-'}</td><td>{a.action}</td><td class="small">{a.detail}</td><td class="small">{a.ip}</td></tr>)}</tbody>
    </table>
  </>);
});

admin.route('/', crud);

export default admin;
