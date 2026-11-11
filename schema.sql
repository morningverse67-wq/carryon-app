-- CarryOn website stats. No IPs, full user agents, visitor cookies or anything else that identifies a person.
-- /admin shows Korean days: a downloads row keeps its UTC day and time and is converted when read; a hits row is
-- stored under the Korean day since 2026-11-12 (UTC days before that; lib/stats.js SINCE).

-- GET /download, /download/windows, /download/windows-zip, /download/android, /download/ios: one row per click
CREATE TABLE IF NOT EXISTS downloads (
  day TEXT NOT NULL DEFAULT (date('now')),
  time TEXT NOT NULL DEFAULT (strftime('%H:%M', 'now')),
  country TEXT,  -- request.cf.country, e.g. KR
  ref TEXT,      -- the referrer's host only
  os TEXT        -- "<file>@<device>", or just the file when the device is the file's own (lib/stats.js osRow, rowKind).
                 -- files: mac (dmg) | winzip | android (APK) | winstore (to the Microsoft Store) | ios (to the App Store)
                 -- older rows: windows = the zip until 2026-11-11 05:57 UTC, other = the dmg on something that is not a Mac
);
CREATE INDEX IF NOT EXISTS downloads_day ON downloads(day);

-- POST /api/hit, the page's beacon
CREATE TABLE IF NOT EXISTS hits (
  day TEXT NOT NULL DEFAULT (date('now')),  -- /api/hit writes the Korean day: date('now', '+9 hours')
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
  day TEXT NOT NULL,   -- GitHub's own day (UTC)
  kind TEXT NOT NULL,  -- views | clones
  count INTEGER NOT NULL,
  uniques INTEGER NOT NULL,
  PRIMARY KEY (day, kind)
);
CREATE TABLE IF NOT EXISTS gh_referrers (
  day TEXT NOT NULL,   -- the Korean day it was copied; GitHub's list covers the 14 days before it
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

-- Each release file's running download count, copied daily by tools/gh-traffic.sh; the day-to-day growth is the daily GitHub downloads.
CREATE TABLE IF NOT EXISTS gh_assets (
  day TEXT NOT NULL,   -- the Korean day it was copied (10:00 by launchd, so the same date as UTC)
  tag TEXT NOT NULL,   -- the release, e.g. v1.7.0
  name TEXT NOT NULL,  -- the file, e.g. CarryOn.dmg
  count INTEGER NOT NULL,
  PRIMARY KEY (day, tag, name)
);
