import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, MediaRow } from '../types';
import { AdminLayout, Csrf } from './layout';
import { audit, slugify } from '../lib/db';
import { storeUpload } from '../lib/media';
import { clientIp } from '../lib/auth';
import { mediaUrl, fmtEventWhen, fmtDate } from '../lib/format';
import { safeUrl } from '../lib/security';

// A small, declarative content editor. Table and column names come only from
// the configs below (never from the request), and all values are bound
// parameters, so there is no path for SQL injection.

type FieldType = 'text' | 'textarea' | 'markdown' | 'date' | 'datetime' | 'checkbox' | 'number' | 'url' | 'email' | 'image' | 'slug';
type Field = { name: string; label: string; type: FieldType; required?: boolean; help?: string; max?: number; from?: string };
type Resource = {
  table: string;
  plural: string;
  singular: string;
  fields: Field[];
  orderBy: string;
  list: (row: any) => { title: string; sub: string; draft?: boolean };
  publicUrl?: (row: any) => string;
  intro?: string;
};

export const RESOURCES: Record<string, Resource> = {
  events: {
    table: 'events', plural: 'Events', singular: 'Event', orderBy: 'starts_at DESC',
    intro: 'Upcoming events appear on the home page and events calendar. Past events hide automatically.',
    fields: [
      { name: 'title', label: 'Event name', type: 'text', required: true, max: 150 },
      { name: 'starts_at', label: 'Starts', type: 'datetime', required: true },
      { name: 'ends_at', label: 'Ends', type: 'datetime', help: 'Optional.' },
      { name: 'all_day', label: 'All-day event (hide times)', type: 'checkbox' },
      { name: 'location', label: 'Location', type: 'text', max: 200, help: 'Leave blank if it is at the church.' },
      { name: 'summary', label: 'Short description', type: 'textarea', max: 300, help: 'One or two sentences shown on event cards.' },
      { name: 'body_md', label: 'Full details', type: 'markdown' },
      { name: 'image_key', label: 'Image', type: 'image' },
      { name: 'registration_url', label: 'Registration / sign-up link', type: 'url', help: 'e.g. a Planning Center or Church Center registration link.' },
      { name: 'featured', label: 'Feature on the home page', type: 'checkbox' },
      { name: 'published', label: 'Published (visible on the website)', type: 'checkbox' },
    ],
    list: (r) => ({ title: r.title, sub: fmtEventWhen(r.starts_at, r.ends_at, r.all_day), draft: !r.published }),
    publicUrl: (r) => `/events/${r.id}`,
  },
  sermons: {
    table: 'sermons', plural: 'Sermons', singular: 'Sermon', orderBy: 'preached_on DESC',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 150 },
      { name: 'preached_on', label: 'Date', type: 'date', required: true },
      { name: 'speaker', label: 'Speaker', type: 'text', max: 100 },
      { name: 'series', label: 'Series', type: 'text', max: 100 },
      { name: 'scripture', label: 'Scripture', type: 'text', max: 100, help: 'e.g. John 3:1-17' },
      { name: 'video_url', label: 'Video link', type: 'url', help: 'Paste a YouTube or Facebook video link. YouTube videos play right on the page.' },
      { name: 'notes_md', label: 'Sermon notes', type: 'markdown' },
      { name: 'published', label: 'Published', type: 'checkbox' },
    ],
    list: (r) => ({ title: r.title, sub: [fmtDate(r.preached_on + 'T00:00', false), r.speaker].filter(Boolean).join(' · '), draft: !r.published }),
    publicUrl: (r) => `/sermons/${r.id}`,
  },
  pages: {
    table: 'pages', plural: 'Pages', singular: 'Page', orderBy: 'show_in_nav DESC, nav_order, title',
    intro: 'Pages live at /p/page-address. Check "Show in top menu" to add one to the site navigation.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 120 },
      { name: 'slug', label: 'Page address', type: 'slug', from: 'title', help: 'The part after /p/ in the link. Lowercase letters, numbers and dashes.' },
      { name: 'summary', label: 'Subtitle', type: 'text', max: 250 },
      { name: 'body_md', label: 'Content', type: 'markdown' },
      { name: 'image_key', label: 'Header image', type: 'image' },
      { name: 'show_in_nav', label: 'Show in top menu', type: 'checkbox' },
      { name: 'nav_order', label: 'Menu order', type: 'number', help: 'Lower numbers appear first.' },
      { name: 'published', label: 'Published', type: 'checkbox' },
    ],
    list: (r) => ({ title: r.title, sub: `/p/${r.slug}${r.show_in_nav ? ' · in menu' : ''}`, draft: !r.published }),
    publicUrl: (r) => `/p/${r.slug}`,
  },
  ministries: {
    table: 'ministries', plural: 'Ministries', singular: 'Ministry', orderBy: 'sort_order, name',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 100 },
      { name: 'slug', label: 'Page address', type: 'slug', from: 'name', help: 'The part after /ministries/ in the link.' },
      { name: 'audience', label: 'Who it is for', type: 'text', max: 100, help: 'e.g. 6th to 12th grade' },
      { name: 'schedule', label: 'When it meets', type: 'text', max: 100 },
      { name: 'summary', label: 'Short description', type: 'textarea', max: 300 },
      { name: 'body_md', label: 'Full description', type: 'markdown' },
      { name: 'image_key', label: 'Image', type: 'image' },
      { name: 'sort_order', label: 'Display order', type: 'number' },
      { name: 'published', label: 'Published', type: 'checkbox' },
    ],
    list: (r) => ({ title: r.name, sub: [r.audience, r.schedule].filter(Boolean).join(' · '), draft: !r.published }),
    publicUrl: (r) => `/ministries/${r.slug}`,
  },
  staff: {
    table: 'staff', plural: 'Staff', singular: 'Staff member', orderBy: 'sort_order, name',
    intro: 'Staff appear on the About page.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 100 },
      { name: 'role', label: 'Role / title', type: 'text', max: 100 },
      { name: 'bio', label: 'Short bio', type: 'textarea', max: 1000 },
      { name: 'email', label: 'Public email', type: 'email', help: 'Optional. It will be shown on the website.' },
      { name: 'photo_key', label: 'Photo', type: 'image' },
      { name: 'sort_order', label: 'Display order', type: 'number' },
    ],
    list: (r) => ({ title: r.name, sub: r.role }),
    publicUrl: () => '/about#staff',
  },
};

const DEFAULTS: Record<string, any> = { published: 1, nav_order: 100, sort_order: 100 };

async function images(c: Context<Env>) {
  const { results } = await c.env.DB.prepare("SELECT * FROM media WHERE content_type LIKE 'image/%' ORDER BY id DESC LIMIT 200").all<MediaRow>();
  return results;
}

function FieldInput({ f, value, media }: { f: Field; value: any; media: MediaRow[] }) {
  const v = value ?? '';
  const id = `f-${f.name}`;
  const help = f.help && <small class="help">{f.help}</small>;
  switch (f.type) {
    case 'checkbox':
      return <label class="check"><input type="checkbox" name={f.name} value="1" checked={!!value} /> {f.label}</label>;
    case 'textarea':
      return <label for={id}>{f.label}{help}<textarea id={id} name={f.name} rows={3} maxlength={f.max} required={f.required}>{v}</textarea></label>;
    case 'markdown':
      return (
        <div class="md-field">
          <label for={id}>{f.label}</label>
          <div class="md-toolbar" data-for={id}>
            <button type="button" data-md="bold" title="Bold"><b>B</b></button>
            <button type="button" data-md="italic" title="Italic"><i>I</i></button>
            <button type="button" data-md="h2" title="Heading">H</button>
            <button type="button" data-md="list" title="Bulleted list">• List</button>
            <button type="button" data-md="link" title="Link">Link</button>
            <button type="button" data-md="preview" class="right">Preview</button>
          </div>
          <textarea id={id} name={f.name} rows={14} class="mono">{v}</textarea>
          <div class="md-preview prose" hidden></div>
          <small class="help">Formatting tips: **bold**, *italic*, "## " starts a heading, "- " starts a list item, and [link text](https://example.com) makes a link.</small>
        </div>
      );
    case 'image': {
      const current = mediaUrl(value);
      return (
        <fieldset class="image-field">
          <legend>{f.label}</legend>
          {current && <img src={current} alt="" class="thumb" />}
          <label>Choose an existing image
            <select name={f.name}>
              <option value="">None</option>
              {media.map((m) => <option value={m.key} selected={m.key === value}>{m.filename}</option>)}
            </select>
          </label>
          <label>…or upload a new one<input type="file" name={`${f.name}__upload`} accept="image/jpeg,image/png,image/webp,image/gif" /></label>
        </fieldset>
      );
    }
    default: {
      const type = { date: 'date', datetime: 'datetime-local', number: 'number', url: 'url', email: 'email' }[f.type as string] ?? 'text';
      return (
        <label for={id}>{f.label}{f.required && <span class="req"> *</span>}{help}
          <input id={id} type={type} name={f.name} value={String(v)} maxlength={f.max} required={f.required && f.type !== 'slug'}
            pattern={f.type === 'slug' ? '[a-z0-9-]*' : undefined} data-slug-from={f.from} />
        </label>
      );
    }
  }
}


export const crud = new Hono<Env>();
const TYPES = Object.keys(RESOURCES);

for (const type of TYPES) crud.get(`/${type}`, async (c) => {
  const r = RESOURCES[type];
  const { results } = await c.env.DB.prepare(`SELECT * FROM ${r.table} ORDER BY ${r.orderBy} LIMIT 500`).all();
  const flash = { saved: 'Saved.', deleted: 'Deleted.' }[c.req.query('m') ?? ''];
  return c.html(
    <AdminLayout title={r.plural} user={c.get('user')} csrf={c.get('session').csrf_token} path={`/admin/${type}`} flash={flash}>
      {r.intro && <p class="muted">{r.intro}</p>}
      <p><a class="btn" href={`/admin/${type}/new`}>+ Add {r.singular.toLowerCase()}</a></p>
      {results.length === 0 ? <p class="empty">Nothing here yet.</p> : (
        <ul class="rows">
          {results.map((row: any) => {
            const l = r.list(row);
            return (
              <li>
                <a href={`/admin/${type}/${row.id}`}><strong>{l.title}</strong> {l.draft && <span class="tag">Draft</span>}<br /><span class="muted small">{l.sub}</span></a>
              </li>
            );
          })}
        </ul>
      )}
    </AdminLayout>
  );
});

async function renderEdit(c: Context<Env>, type: string, row: any, error?: string, status = 200) {
  const r = RESOURCES[type];
  const isNew = !row.id;
  const media = await images(c);
  const csrf = c.get('session').csrf_token;
  return c.html(
    <AdminLayout title={isNew ? `New ${r.singular.toLowerCase()}` : `Edit ${r.singular.toLowerCase()}`} user={c.get('user')} csrf={csrf} path={`/admin/${type}`}>
      <p><a href={`/admin/${type}`}>← Back to {r.plural.toLowerCase()}</a>
        {!isNew && r.publicUrl && <> · <a href={r.publicUrl(row)} target="_blank" rel="noopener">View on website ↗</a></>}</p>
      {error && <div class="notice error" role="alert">{error}</div>}
      <form method="post" enctype="multipart/form-data" class="form" action={isNew ? `/admin/${type}/new` : `/admin/${type}/${row.id}`}>
        <Csrf token={csrf} />
        {r.fields.map((f) => <FieldInput f={f} value={row[f.name]} media={media} />)}
        <div class="form-actions"><button class="btn" type="submit">Save</button></div>
      </form>
      {!isNew && (
        <form method="post" action={`/admin/${type}/${row.id}/delete`} class="danger-zone" data-confirm={`Delete this ${r.singular.toLowerCase()}? This cannot be undone.`}>
          <Csrf token={csrf} />
          <button class="btn btn-danger" type="submit">Delete</button>
        </form>
      )}
    </AdminLayout>,
    status as any
  );
}

for (const type of TYPES) crud.get(`/${type}/new`, (c) => renderEdit(c, type, { ...DEFAULTS }));

for (const type of TYPES) crud.get(`/${type}/:id{[0-9]+}`, async (c) => {
  const r = RESOURCES[type];
  const row = await c.env.DB.prepare(`SELECT * FROM ${r.table} WHERE id = ?`).bind(Number(c.req.param('id'))).first();
  if (!row) return c.notFound();
  return renderEdit(c, type, row);
});

async function save(c: Context<Env>, type: string, id: number | null) {
  const r = RESOURCES[type];
  const body = await c.req.parseBody();
  const values: Record<string, any> = {};
  const row: Record<string, any> = { id };
  let error: string | undefined;

  for (const f of r.fields) {
    const raw = body[f.name];
    const str = typeof raw === 'string' ? raw.trim() : '';
    let v: any;
    switch (f.type) {
      case 'checkbox': v = str === '1' ? 1 : 0; break;
      case 'number': v = Number.isFinite(Number(str)) && str !== '' ? Math.trunc(Number(str)) : (DEFAULTS[f.name] ?? 0); break;
      case 'date': v = /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : ''; break;
      case 'datetime': v = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str) ? str.slice(0, 16) : null; break;
      case 'url': v = str; if (str && !safeUrl(str)) error ??= `${f.label} must start with https://`; break;
      case 'email': v = str; if (str && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) error ??= `${f.label} is not a valid email.`; break;
      case 'slug': v = slugify(str || String(body[f.from!] ?? '')); break;
      case 'image': {
        v = str || null;
        const up = body[`${f.name}__upload`];
        if (up instanceof File && up.size > 0) {
          const res = await storeUpload(c.env, up, c.get('user').id, true);
          if (res.ok) v = res.key; else error ??= res.error;
        } else if (v) {
          const exists = await c.env.DB.prepare('SELECT 1 FROM media WHERE key = ?').bind(v).first();
          if (!exists) v = null;
        }
        break;
      }
      case 'markdown': v = typeof raw === 'string' ? raw.slice(0, 50000) : ''; break;
      default: v = f.max ? str.slice(0, f.max) : str.slice(0, 5000);
    }
    if (f.required && (v === '' || v === null)) error ??= `${f.label} is required.`;
    values[f.name] = v;
    row[f.name] = v;
  }
  if (type === 'events' && values.ends_at && values.ends_at < values.starts_at) error ??= 'The end time is before the start time.';
  if ('slug' in values) {
    if (!values.slug) error ??= 'Please enter a page address.';
    const clash = await c.env.DB.prepare(`SELECT id FROM ${r.table} WHERE slug = ? AND id IS NOT ?`).bind(values.slug, id).first();
    if (clash) error ??= 'Another item already uses that page address.';
  }
  if (error) return renderEdit(c, type, row, error, 400);

  const cols = Object.keys(values);
  const hasUpdated = ['pages', 'events', 'sermons'].includes(type);
  let savedId = id;
  if (id) {
    const set = cols.map((k) => `${k} = ?`).join(', ') + (hasUpdated ? ", updated_at = datetime('now')" : '');
    await c.env.DB.prepare(`UPDATE ${r.table} SET ${set} WHERE id = ?`).bind(...cols.map((k) => values[k]), id).run();
  } else {
    const res = await c.env.DB.prepare(`INSERT INTO ${r.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...cols.map((k) => values[k])).run();
    savedId = res.meta.last_row_id;
  }
  await audit(c.env, c.get('user').id, id ? `update ${type}` : `create ${type}`, `#${savedId} ${values.title ?? values.name ?? ''}`, clientIp(c));
  return c.redirect(`/admin/${type}?m=saved`, 303);
}

for (const type of TYPES) {
  crud.post(`/${type}/new`, (c) => save(c, type, null));
  crud.post(`/${type}/:id{[0-9]+}`, (c) => save(c, type, Number(c.req.param('id'))));
}

for (const type of TYPES) crud.post(`/${type}/:id{[0-9]+}/delete`, async (c) => {
  const r = RESOURCES[type];
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare(`DELETE FROM ${r.table} WHERE id = ?`).bind(id).run();
  await audit(c.env, c.get('user').id, `delete ${type}`, `#${id}`, clientIp(c));
  return c.redirect(`/admin/${type}?m=deleted`, 303);
});
