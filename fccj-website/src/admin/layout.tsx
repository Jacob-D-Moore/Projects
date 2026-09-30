import type { Child } from 'hono/jsx';
import type { User } from '../types';

type Props = { title: string; user?: User; csrf?: string; path?: string; unread?: number; children: Child; flash?: string };

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/sermons', label: 'Sermons' },
  { href: '/admin/pages', label: 'Pages' },
  { href: '/admin/ministries', label: 'Ministries' },
  { href: '/admin/staff', label: 'Staff' },
  { href: '/admin/media', label: 'Images & Files' },
  { href: '/admin/settings', label: 'Site Settings' },
];
const ADMIN_NAV = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/audit', label: 'Activity Log' },
];

export function AdminLayout({ title, user, csrf, path = '', unread = 0, children, flash }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        {csrf && <meta name="csrf-token" content={csrf} />}
        <title>{title} · FCCJ Admin</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/css/admin.css" />
        <script src="/js/admin.js" defer></script>
      </head>
      <body class={user ? 'has-nav' : 'bare'}>
        {user ? (
          <div class="shell">
            <aside class="side">
              <a class="side-brand" href="/admin"><img src="/favicon.svg" alt="" width="28" height="28" /> FCCJ Admin</a>
              <nav>
                  {NAV.map((n) => (
                    <a href={n.href} aria-current={(n.href === '/admin' ? path === '/admin' : path.startsWith(n.href)) ? 'page' : undefined}>
                      {n.label}{n.href === '/admin/messages' && unread > 0 && <span class="badge">{unread}</span>}
                    </a>
                  ))}
                  {user.role === 'admin' && <hr />}
                  {user.role === 'admin' && ADMIN_NAV.map((n) => <a href={n.href} aria-current={path.startsWith(n.href) ? 'page' : undefined}>{n.label}</a>)}
                  <hr />
                  <a href="/admin/account" aria-current={path.startsWith('/admin/account') ? 'page' : undefined}>My Account</a>
                  <a href="/" target="_blank" rel="noopener">View Website ↗</a>
                  <form method="post" action="/admin/logout">
                    <input type="hidden" name="_csrf" value={csrf} />
                    <button class="linkish" type="submit">Sign out</button>
                  </form>
              </nav>
              <p class="side-user">Signed in as <strong>{user.name}</strong></p>
            </aside>
            <main class="content">
              <h1>{title}</h1>
              {flash && <div class="notice success" role="status">{flash}</div>}
              {children}
            </main>
          </div>
        ) : (
          <main class="auth-box">
            <p class="auth-brand"><img src="/favicon.svg" alt="" width="40" height="40" /></p>
            <h1>{title}</h1>
            {children}
          </main>
        )}
      </body>
    </html>
  );
}

export function Csrf({ token }: { token: string }) {
  return <input type="hidden" name="_csrf" value={token} />;
}
