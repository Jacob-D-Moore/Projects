import type { Child } from 'hono/jsx';
import type { NavItem, Settings } from '../types';
import { safeUrl } from '../lib/security';

type Props = {
  s: Settings;
  nav: NavItem[];
  title?: string;
  description?: string;
  path: string;
  children: Child;
};

const MAIN_NAV: NavItem[] = [
  { href: '/about', label: 'About' },
  { href: '/ministries', label: 'Ministries' },
  { href: '/events', label: 'Events' },
  { href: '/sermons', label: 'Sermons' },
];

export function Layout({ s, nav, title, description, path, children }: Props) {
  const name = s.church_name || 'First Christian Church Jonesboro';
  const fullTitle = title ? `${title} | ${name}` : `${name} | ${s.tagline ?? ''}`;
  const items = [...MAIN_NAV.slice(0, 1), ...nav, ...MAIN_NAV.slice(1)];
  const alertLink = safeUrl(s.alert_link);
  const social = [
    { href: safeUrl(s.facebook_url), label: 'Facebook' },
    { href: safeUrl(s.youtube_url), label: 'YouTube' },
    { href: safeUrl(s.instagram_url), label: 'Instagram' },
  ].filter((x) => x.href);
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.address_street}, ${s.address_city}`)}`;

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{fullTitle}</title>
        <meta name="description" content={description || s.hero_subheading || ''} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description || s.hero_subheading || ''} />
        <meta property="og:type" content="website" />
        <meta name="theme-color" content="#0f3d56" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/css/site.css" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(s) }} />
      </head>
      <body>
        <a class="skip" href="#main">Skip to content</a>
        {s.alert_enabled === '1' && s.alert_text && (
          <div class="alert-bar" role="status">
            <span>{s.alert_text}</span>
            {alertLink && <a href={alertLink}>Learn more →</a>}
          </div>
        )}
        <header class="site-header">
          <div class="wrap header-inner">
            <a class="brand" href="/">
              <img src="/favicon.svg" alt="" width="36" height="36" />
              <span>
                <strong>{s.short_name || 'FCCJ'}</strong>
                <small>{name}</small>
              </span>
            </a>
            <nav class="desk-nav" aria-label="Main">
              <NavLinks items={items} path={path} />
            </nav>
            <details class="menu">
              <summary aria-label="Menu"><span></span><span></span><span></span></summary>
              <nav aria-label="Main (mobile)">
                <NavLinks items={items} path={path} />
              </nav>
            </details>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer class="site-footer">
          <div class="wrap footer-grid">
            <div>
              <h2>{name}</h2>
              <p class="muted">{s.tagline}</p>
              {social.length > 0 && (
                <p class="social">{social.map((x) => <a href={x.href!} target="_blank" rel="noopener noreferrer">{x.label}</a>)}</p>
              )}
            </div>
            <div>
              <h3>Sundays</h3>
              <p>{s.time_classes} · Bible study for all ages<br />{s.time_worship} · Worship service</p>
            </div>
            <div>
              <h3>Visit</h3>
              <p><a href={mapHref} target="_blank" rel="noopener noreferrer">{s.address_street}<br />{s.address_city}</a></p>
              <p>
                {s.phone && <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}>{s.phone}</a>}<br />
                {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
              </p>
            </div>
          </div>
          <div class="wrap footer-bottom">
            <span>© {new Date().getFullYear()} {name}</span>
            <a href="/admin">Staff login</a>
          </div>
        </footer>
      </body>
    </html>
  );
}

function NavLinks({ items, path }: { items: NavItem[]; path: string }) {
  return <>
    {items.map((i) => (
      <a href={i.href} aria-current={path === i.href || (i.href !== '/' && path.startsWith(i.href + '/')) ? 'page' : undefined}>{i.label}</a>
    ))}
    <a class="btn btn-small" href="/give">Give</a>
    <a class="btn btn-small btn-outline" href="/contact">Contact</a>
  </>;
}

function jsonLd(s: Settings): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: s.church_name,
    telephone: s.phone,
    email: s.email,
    address: { '@type': 'PostalAddress', streetAddress: s.address_street, addressLocality: s.address_city },
  };
  // Escape "<" so admin-entered text can never close the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function PageHero({ title, lead }: { title: string; lead?: string }) {
  return (
    <section class="page-hero">
      <div class="wrap">
        <h1>{title}</h1>
        {lead && <p class="lead">{lead}</p>}
      </div>
    </section>
  );
}

export function Prose({ html }: { html: string }) {
  return <div class="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
