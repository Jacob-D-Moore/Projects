# First Christian Church Jonesboro Website

A fast, secure, database-driven church website with an easy admin area. It runs on
**Cloudflare's free tier**, so hosting costs **$0/month**. You only pay for the
domain name (about $10–15/year).

- **Public site:** home, about and beliefs, staff, ministries, events calendar (with a
  subscribe-able calendar feed), sermons (YouTube embeds and notes), give, contact
  form, and any extra pages you create.
- **Admin area** (`/admin`): edit everything without touching code. That includes an
  announcement banner (for weather closures and similar news), events, sermons,
  pages, ministries, staff, photos/PDFs, service times, giving and social links,
  contact-form messages, user accounts, and an activity log.

## What it costs

| Service | Free tier | Typical church usage |
|---|---|---|
| Cloudflare Workers | 100,000 requests/day | a few thousand/day |
| Cloudflare D1 (database) | 5 GB, 5M reads/day | a few MB |
| Cloudflare R2 (photos/PDFs) | 10 GB, no bandwidth fees | well under 1 GB |

R2 requires a payment method on file even while you stay within the free tier.

## Security

- Passwords are hashed with PBKDF2-SHA256 (100k iterations, per-user salt) and are
  never stored or logged in plain text.
- **Two-step verification (TOTP)** works with any authenticator app. Each person turns
  it on under *My Account*. Used codes can't be replayed.
- Sessions use random 256-bit tokens, stored only as SHA-256 hashes. Cookies are
  `__Host-` prefixed, `HttpOnly`, `Secure` and `SameSite=Strict`. Sessions expire after
  12 hours, or after 2 hours of inactivity.
- Every admin change requires a per-session **CSRF token** plus a same-origin check.
- **Brute-force protection:** each account allows 5 failed sign-ins per 15 minutes,
  each IP address allows 20, and failed 2FA codes are limited too.
- Strict **Content Security Policy**: no inline scripts, and no third-party scripts
  except optional Turnstile. HSTS, `X-Frame-Options`, `nosniff`, a strict Referrer
  and Permissions policy, and COOP are also set.
- All database queries are parameterized, and table and column names come only
  from code.
- Admin-written Markdown is rendered with raw HTML escaped. `javascript:` and other
  unsafe links are stripped.
- Uploads are identified by their actual bytes, not the file name. Only
  JPG/PNG/WebP/GIF/PDF are accepted (no SVG), and files are stored under random names.
- Roles: **editors** manage content, and **admins** also manage users and the
  activity log. The last admin can't be removed.
- The contact form has a honeypot, rate limits, and optional
  [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) spam checks.
- There is no server, OS or plugin system to patch. Cloudflare runs and updates the
  platform.

**Extra hardening (optional, free):** put `/admin*` behind
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/)
(Zero Trust free plan, up to 50 users). Staff then also have to verify their email
before they can even see the login page.

---

## Going live (one-time setup, ~30 minutes)

You need a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and
[Node.js](https://nodejs.org) 20 or newer on your computer.

```bash
cd fccj-website
npm install
npx wrangler login                      # opens a browser to authorize

# 1. Create the database, then paste the printed database_id into wrangler.toml
npx wrangler d1 create fccj-db

# 2. Create the storage bucket for photos and PDFs
npx wrangler r2 bucket create fccj-media

# 3. Set a long random one-time setup token (you'll use it once, in step 5)
npx wrangler secret put SETUP_TOKEN

# 4. Create the tables + starter content, and deploy
npm run deploy
```

5. Open `https://fccj-website.<your-subdomain>.workers.dev/admin/setup?token=YOUR_SETUP_TOKEN`
   and create your admin account. Then go to **My Account** and turn on two-step
   verification. After that you can remove the token with
   `npx wrangler secret delete SETUP_TOKEN`. Setup is also disabled automatically
   once any account exists.
6. **Review the starter content.** It was gathered from the public web (the old site
   blocked direct access), so check staff last names, beliefs wording, Wednesday
   times and so on. Add the **online giving link** (for example your Church Center
   giving page) and the **meal reservation link** under *Site Settings → Links*.

### Point fccjonesboro.org at the new site

1. In Cloudflare, **Add a site** → `fccjonesboro.org` → Free plan. Then update the
   nameservers at your domain registrar as Cloudflare instructs.
   - If email (`churchoffice@fccjonesboro.org`) is hosted elsewhere (Google, Microsoft
     and so on), make sure the MX/TXT records Cloudflare imports match your current
     DNS before switching.
2. In **Workers & Pages → fccj-website → Settings → Domains & Routes**, add the
   custom domains `fccjonesboro.org` and `www.fccjonesboro.org`.
3. Once the new site works on your domain, cancel the old hosting plan. Old page
   URLs (`/about-us`, `/plan-a-visit`, `/startingpoint`, `/lights`, …) automatically
   redirect to the new pages, so existing links and Google results keep working.

### Optional: spam protection on the contact form

Create a Turnstile widget in the Cloudflare dashboard, then:

```bash
npx wrangler secret put TURNSTILE_SITE_KEY
npx wrangler secret put TURNSTILE_SECRET
```

---

## Local development

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev            # http://127.0.0.1:8787
# first account: http://127.0.0.1:8787/admin/setup?token=change-me-local-setup-token
npm run typecheck
```

## Project layout

```
migrations/0001_init.sql   database schema + starter content
src/index.tsx              app entry: security headers, routing, errors
src/public.tsx             public pages, contact form, calendar feed, sitemap
src/admin/index.tsx        login, 2FA, dashboard, settings, messages, media, users
src/admin/crud.tsx         editors for events, sermons, pages, ministries, staff
src/lib/security.ts        password hashing, TOTP, URL/HTML safety
src/lib/auth.ts            sessions, CSRF, auth middleware
public/                    CSS, admin JS, logo
```

## Backups

Cloudflare D1 keeps point-in-time recovery automatically (7 days on the free plan). For an extra
copy: `npx wrangler d1 export fccj-db --remote --output=backup.sql`.
