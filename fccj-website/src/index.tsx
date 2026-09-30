import { Hono } from 'hono';
import type { Env } from './types';
import publicApp from './public';
import adminApp from './admin';
import { loadNav, loadSettings } from './lib/db';
import { Layout, PageHero } from './views/layout';

const app = new Hono<Env>();

// Security headers on every dynamic response (static files get theirs from public/_headers).
app.use('*', async (c, next) => {
  await next();
  const h = c.res.headers;
  if (!h.has('Content-Security-Policy')) {
    h.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "style-src 'self'",
      "img-src 'self' data: https:",
      "frame-src https://www.youtube-nocookie.com https://challenges.cloudflare.com",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '));
  }
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
});

// Site settings and navigation are needed by every page, public and admin.
app.use('*', async (c, next) => {
  const [settings, nav] = await Promise.all([loadSettings(c.env.DB), loadNav(c.env.DB)]);
  c.set('settings', settings);
  c.set('nav', nav);
  await next();
});

app.route('/admin', adminApp);
app.route('/', publicApp);

app.notFound((c) => {
  if (c.req.path.startsWith('/admin')) return c.text('Not found', 404);
  return c.html(
    <Layout s={c.get('settings') ?? {}} nav={c.get('nav') ?? []} title="Page not found" path={c.req.path}>
      <PageHero title="Page not found" lead="Sorry, we couldn't find that page." />
      <section class="section"><div class="wrap narrow"><p><a class="btn" href="/">Go to the home page</a></p></div></section>
    </Layout>,
    404
  );
});

app.onError((err, c) => {
  // Log details server-side (visible with `wrangler tail`); never show them to visitors.
  console.error(err);
  return c.text('Something went wrong. Please try again in a moment.', 500);
});

export default app;
