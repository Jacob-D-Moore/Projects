-- ============================================================
-- Schema
-- ============================================================
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor')),
  totp_secret   TEXT,
  totp_enabled  INTEGER NOT NULL DEFAULT 0,
  totp_last_step INTEGER NOT NULL DEFAULT 0,
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- Session ids are stored only as SHA-256 hashes; the raw id lives in the cookie.
CREATE TABLE sessions (
  id_hash     TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token  TEXT NOT NULL,
  mfa_pending INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  ts     INTEGER NOT NULL
);
CREATE INDEX idx_rate_limits ON rate_limits(bucket, ts);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE pages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  body_md     TEXT NOT NULL DEFAULT '',
  image_key   TEXT,
  published   INTEGER NOT NULL DEFAULT 1,
  show_in_nav INTEGER NOT NULL DEFAULT 0,
  nav_order   INTEGER NOT NULL DEFAULT 100,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  starts_at        TEXT NOT NULL,          -- 'YYYY-MM-DDTHH:MM' church local time
  ends_at          TEXT,
  all_day          INTEGER NOT NULL DEFAULT 0,
  location         TEXT NOT NULL DEFAULT '',
  summary          TEXT NOT NULL DEFAULT '',
  body_md          TEXT NOT NULL DEFAULT '',
  image_key        TEXT,
  registration_url TEXT NOT NULL DEFAULT '',
  featured         INTEGER NOT NULL DEFAULT 0,
  published        INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_start ON events(starts_at);

CREATE TABLE sermons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  speaker     TEXT NOT NULL DEFAULT '',
  preached_on TEXT NOT NULL,              -- 'YYYY-MM-DD'
  series      TEXT NOT NULL DEFAULT '',
  scripture   TEXT NOT NULL DEFAULT '',
  video_url   TEXT NOT NULL DEFAULT '',
  notes_md    TEXT NOT NULL DEFAULT '',
  published   INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sermons_date ON sermons(preached_on);

CREATE TABLE staff (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT '',
  bio        TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  photo_key  TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE ministries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  audience   TEXT NOT NULL DEFAULT '',
  schedule   TEXT NOT NULL DEFAULT '',
  summary    TEXT NOT NULL DEFAULT '',
  body_md    TEXT NOT NULL DEFAULT '',
  image_key  TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  published  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  topic      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE media (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  key          TEXT NOT NULL UNIQUE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size         INTEGER NOT NULL,
  uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  action     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Starter content (gathered from the current public site; review & edit in /admin)
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('church_name',      'First Christian Church Jonesboro'),
  ('short_name',       'FCCJ'),
  ('tagline',          'A Love for God, a Heart for People'),
  ('address_street',   '2272 Walt Stephens Rd'),
  ('address_city',     'Jonesboro, GA 30236'),
  ('address_note',     'Across from Lake Spivey, next to Clayton County International Park and Spivey Splash Water Park.'),
  ('phone',            '(770) 478-7870'),
  ('email',            'churchoffice@fccjonesboro.org'),
  ('time_classes',     '9:30 AM'),
  ('time_worship',     '11:00 AM'),
  ('hero_heading',     'A Love for God, a Heart for People'),
  ('hero_subheading',  'A non-denominational church in Jonesboro, Georgia. Come as you are. We would love to meet you this Sunday.'),
  ('hero_image_key',   ''),
  ('give_url',         ''),
  ('give_text',        'When you give to First Christian Church Jonesboro, your gift supports life-changing ministry in two ways: outward ministries such as missionaries at home and overseas, outreach events, and benevolence; and inward ministries that keep our church family running, including staff and ministry programs.'),
  ('meal_url',         ''),
  ('livestream_url',   ''),
  ('facebook_url',     'https://www.facebook.com/fccjonesboro'),
  ('youtube_url',      ''),
  ('instagram_url',    ''),
  ('alert_enabled',    '0'),
  ('alert_text',       ''),
  ('alert_link',       ''),
  ('about_md',         'First Christian Church Jonesboro is a group of people who have a love for God and a heart for people. As a non-denominational church in Jonesboro, Georgia, we strive to build a God-centered community where everyone is welcomed, known, and encouraged to follow Jesus.'),
  ('beliefs_md',       '- **The Bible** is the inspired Word of God and our guide for faith and life.
- **Jesus Christ** is the Son of God, who died for our sins and rose again. He is the only hope for the world.
- **Salvation** is a gift of God''s grace, received through faith in Jesus.
- **Baptism** is an important step of obedience and a public expression of faith in Christ.
- **Communion** is shared every Sunday as we remember the death and resurrection of Jesus.
- **The Church** is a family of believers called to love God, love people, and make disciples.

*Want to talk more about what we believe? Join us for [Starting Point](/p/starting-point) or [contact us](/contact).*');

INSERT INTO pages (slug, title, summary, body_md, show_in_nav, nav_order) VALUES
('plan-a-visit', 'Plan Your Visit', 'Here is what to expect on your first Sunday.',
'At First Christian Church Jonesboro you will be welcomed into a friendly, casual environment by people who are excited to see you.

## Sunday schedule

- **9:30 AM · Bible study classes** for all ages
- **11:00 AM · Worship service**

## What is a service like?

A service is about 70 minutes long. It begins with the FCCJ band leading worship, followed by communion, when we remember the death and resurrection of Jesus, and then a biblical sermon from our minister.

## What about my kids?

Children from birth through 5th grade have their own classes and worship in a safe, fun, engaging environment led by experienced, caring, background-checked volunteers.

## Where do I go?

We are at **2272 Walt Stephens Rd, Jonesboro, GA 30236**, across from Lake Spivey and next to Clayton County International Park and Spivey Splash Water Park. Look for a greeter at the front doors and they will help you find your way.', 1, 10),

('starting-point', 'Starting Point', 'New here? Start here.',
'Starting Point is a one-time introductory session designed to give you a full picture of who we are and what we believe.

It meets once a month during Sunday morning Bible study at **9:30 AM** and lasts about an hour. Dates vary each month. Check the [events calendar](/events) or [contact the office](/contact).

## In Starting Point you will

- Discover the core values and principles of First Christian Church Jonesboro
- Explore what we believe, including baptism and why it matters
- Learn about membership and how to get involved in our community', 0, 100),

('lights', 'Lights at Jonesboro', 'A drive-in Christmas light show synced to music.',
'Every Christmas season our parking lot turns into a drive-in light show celebrating the birth of Jesus Christ.

Park your car, tune your radio to the show''s station, and watch the lights dance in sync with the music, all from the comfort of your vehicle.

## When

Friday, Saturday, and Sunday evenings, **7:00 to 10:00 PM**, from late November through December. Check the [events calendar](/events) for this year''s dates.

## Where

2272 Walt Stephens Rd, Jonesboro, GA 30236, next to Spivey Splash Water Park and across from Lake Spivey.', 0, 100),

('serve', 'Serve', 'Local missions and service opportunities.',
'We believe a heart for people means rolling up our sleeves.

## Jesus Place Inner City Mission

On the **first Sunday of every month** we serve at Jesus Place Inner City Mission. Everyone is welcome to join.

## Missions

Part of every gift to FCCJ supports missionaries both locally and overseas, outreach events, and benevolence for neighbors in need.', 0, 100);

INSERT INTO ministries (slug, name, audience, schedule, summary, body_md, sort_order) VALUES
('kids', 'Children''s Ministry', 'Birth to 5th grade', 'Sundays 9:30 AM & 11:00 AM',
 'A safe, fun, engaging place for kids to learn about the love of Jesus.',
 'Our nursery and children''s classes, from birth through 5th grade, are led by experienced and caring volunteers who teach little ones about Jesus in an age-appropriate and fun way.

Kids have their own classes during the 9:30 AM Bible study hour and their own worship during the 11:00 AM service.', 10),
('students', 'Student Ministry', '6th to 12th grade', 'Wednesday nights',
 'Walking alongside students as they navigate life, family, friendships, and school.',
 'Our student ministry is for 6th through 12th graders. Each gathering has a time of teaching followed by small groups with leaders, divided by grade and gender, for more personal, in-depth study and accountability.', 20),
('adults', 'Adult Bible Study', 'Adults', 'Sundays 9:30 AM',
 'Classes for different ages and interests to study the Bible and do life together.',
 'We offer adult Bible study classes for a range of ages and interests. Each week people come together to study God''s Word and enjoy fellowship. New? Try [Starting Point](/p/starting-point).', 30),
('worship', 'Worship Ministry', 'Everyone', 'Sundays 11:00 AM',
 'Musicians and tech volunteers who lead us in worship each Sunday.',
 'The FCCJ band leads us in worship each Sunday. If you sing, play, or like working behind the scenes with sound, lights, and slides, we would love to have you on the team.', 40),
('wednesday-meal', 'Wednesday Night Meal', 'Everyone', 'Wednesday evenings',
 'Share a meal with your church family in the middle of the week.',
 'Join us Wednesday evenings for a meal together. Please make a reservation so our kitchen team knows how many to expect.', 50);

INSERT INTO staff (name, role, bio, sort_order) VALUES
('Wade Hall', 'Senior Minister', '', 10),
('Jacob', 'Youth Minister', 'Jacob is married to Kristen and they have two daughters.', 20),
('Jesse', 'Worship Minister', 'Jesse is married to Kaitlyn.', 30),
('Kaitlyn', 'Administrative Assistant', 'Kaitlyn is married to Jesse.', 40);
