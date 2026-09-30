export type Bindings = {
  DB: D1Database;
  MEDIA: R2Bucket;
  SETUP_TOKEN?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  DEV_INSECURE_COOKIES?: string;
};

export type User = {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'editor';
  totp_enabled: number;
};

export type Session = {
  id_hash: string;
  user_id: number;
  csrf_token: string;
  mfa_pending: number;
  expires_at: number;
};

export type Env = {
  Bindings: Bindings;
  Variables: {
    user: User;
    session: Session;
    settings: Settings;
    nav: NavItem[];
    nonce: string;
  };
};

export type Settings = Record<string, string>;
export type NavItem = { href: string; label: string };

export type PageRow = { id: number; slug: string; title: string; summary: string; body_md: string; image_key: string | null; published: number; show_in_nav: number; nav_order: number; updated_at: string };
export type EventRow = { id: number; title: string; starts_at: string; ends_at: string | null; all_day: number; location: string; summary: string; body_md: string; image_key: string | null; registration_url: string; featured: number; published: number };
export type SermonRow = { id: number; title: string; speaker: string; preached_on: string; series: string; scripture: string; video_url: string; notes_md: string; published: number };
export type StaffRow = { id: number; name: string; role: string; bio: string; email: string; photo_key: string | null; sort_order: number };
export type MinistryRow = { id: number; slug: string; name: string; audience: string; schedule: string; summary: string; body_md: string; image_key: string | null; sort_order: number; published: number };
export type MessageRow = { id: number; name: string; email: string; phone: string; topic: string; body: string; is_read: number; ip: string | null; created_at: string };
export type MediaRow = { id: number; key: string; filename: string; content_type: string; size: number; created_at: string };
