-- CarryOn website stats. No IPs, full user agents, cookies or anything else that identifies a person. Days and times are UTC.

-- GET /download, /download/android
CREATE TABLE IF NOT EXISTS downloads (
  day TEXT NOT NULL DEFAULT (date('now')),
  time TEXT NOT NULL DEFAULT (strftime('%H:%M', 'now')),
  country TEXT,  -- request.cf.country, e.g. KR
  ref TEXT,      -- the referrer's host only
  os TEXT        -- mac | other, from the user agent; android = the APK (/download/android), windows = the zip (/download/windows)
);
CREATE INDEX IF NOT EXISTS downloads_day ON downloads(day);

-- POST /api/hit, the page's beacon
CREATE TABLE IF NOT EXISTS hits (
  day TEXT NOT NULL DEFAULT (date('now')),
  path TEXT,
  ref TEXT,      -- the referrer's host, never the site itself
  country TEXT,
  lang TEXT,     -- the language the page was shown in: en | ko | ja | zh | de | fr | es | it | nl | pt
  src TEXT       -- the link's ?s= tag (ytch, igdm, ig ...): letters, digits, hyphens, 32 at most
);
-- A table made before src: npx wrangler@4 d1 execute carryon-stats --remote --command "ALTER TABLE hits ADD COLUMN src TEXT"
CREATE INDEX IF NOT EXISTS hits_day ON hits(day);

-- GitHub's repo traffic, copied daily by tools/gh-traffic.sh (GitHub keeps 14 days only)
CREATE TABLE IF NOT EXISTS gh_daily (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,  -- views | clones
  count INTEGER NOT NULL,
  uniques INTEGER NOT NULL,
  PRIMARY KEY (day, kind)
);
CREATE TABLE IF NOT EXISTS gh_referrers (
  day TEXT NOT NULL,   -- the day it was copied; GitHub's list covers the 14 days before it
  referrer TEXT NOT NULL,
  count INTEGER NOT NULL,
  uniques INTEGER NOT NULL,
  PRIMARY KEY (day, referrer)
);

-- POST /api/report, the site's bug form. The only table here that can hold something personal: the email, when one is given.
CREATE TABLE IF NOT EXISTS reports (
  day TEXT NOT NULL DEFAULT (date('now')),
  time TEXT NOT NULL DEFAULT (strftime('%H:%M', 'now')),
  country TEXT,
  os TEXT,       -- what the form filled in from the browser, e.g. macOS, Android 14; the sender can change it
  ver TEXT,      -- the app version, if given
  body TEXT NOT NULL,  -- what went wrong, 2,000 characters at most
  email TEXT,    -- for a reply, if given
  who TEXT       -- 6 hex characters of SHA-256(day | IP): caps one place at 5 a day; not the IP
);
CREATE INDEX IF NOT EXISTS reports_day ON reports(day, who);
