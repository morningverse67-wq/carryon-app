-- CarryOn website stats. No IPs, full user agents, cookies or anything else that identifies a person. Days and times are UTC.

-- GET /download
CREATE TABLE IF NOT EXISTS downloads (
  day TEXT NOT NULL DEFAULT (date('now')),
  time TEXT NOT NULL DEFAULT (strftime('%H:%M', 'now')),
  country TEXT,  -- request.cf.country, e.g. KR
  ref TEXT,      -- the referrer's host only
  os TEXT        -- mac | other, from the user agent
);
CREATE INDEX IF NOT EXISTS downloads_day ON downloads(day);

-- POST /api/hit, the page's beacon
CREATE TABLE IF NOT EXISTS hits (
  day TEXT NOT NULL DEFAULT (date('now')),
  path TEXT,
  ref TEXT,      -- the referrer's host, never the site itself
  country TEXT,
  lang TEXT      -- the language the page was shown in: en | ko | ja | zh
);
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
