// Shared by the site's Functions: what counts as a bot, what is kept of a referrer, the key check, and how the
// rows turn into the numbers /admin shows. Nothing here keeps an IP or a full user agent, and no visitor gets a cookie
// (the one cookie, co_me, goes to the browser that opens /admin with the key, so our own clicks stay out).

export const HOME = "carryon-app.pages.dev";  // the one host that counts; previews and per-deploy hosts do not
// The day this way of counting went live, Korean time. /admin's notes say "before this day" for what older rows can not tell.
export const SINCE = "2026-11-12";

export const DMG = "https://github.com/morningverse67-wq/carryon-app/releases/latest/download/CarryOn.dmg";
// ponytail: the APK is on a fixed tag, so each new APK moves this line; a latest/download name when Play or a second beta asks for it.
export const APK = "https://github.com/morningverse67-wq/carryon-app/releases/download/v1.8.0/CarryOn-android-1.8.0-beta-21.apk";
// ponytail: the Windows zip is on a fixed tag too (since 1.8.0: in the same release as the dmg); move it with each Windows beta.
export const WINSTORE = "https://apps.microsoft.com/detail/9NFL1279L4HX";  // 11-11 Microsoft Store 게시 확인(Partner Center "In the Microsoft Store")
export const WINZIP = "https://github.com/morningverse67-wq/carryon-app/releases/download/v1.8.1/CarryOn-windows-x64-1.8.1-beta.zip";
export const APPSTORE = "https://apps.apple.com/kr/app/carryon-ai-sessions/id6831468074?ct=site";  // ct= is the App Store's own source tag
export const LANGS = ["en", "ko", "ja", "zh", "de", "fr", "es", "it", "nl", "pt"];  // the site's ?lang= list

// Obvious bots, link previews, command-line tools and AI fetchers; no user agent at all counts as one, and so does
// anything that is not a browser ("Mozilla/5.0 …") or our own installer (docs/install.sh, "CarryOn-install (Macintosh)"):
// Android's download manager and apps' background fetches ask again for a link a person already opened.
// In-app browsers (KakaoTalk, Instagram, Threads, NAVER, LINE …) are people and must pass; lib/stats.test.mjs has their user agents.
// ponytail: "bot" also matches a Cubot phone; tighten it if such a phone ever shows up.
const BOTS = /bot|crawl|spider|slurp|archiver|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|undici|httpclient|headless|phantom|lighthouse|pagespeed|preview|externalhit|externalagent|whatsapp|embedly|vkshare|bitly|scan|monitor|carryon-check|compatible;|yeti|daumoa|scrap|fetch|proxy|inspect|google-|googleother|mediapartners|chatgpt|openai|claude-|anthropic|perplexity|mistralai|cohere|libwww|ruby|perl|php|guzzle|postman|insomnia|powershell|winhttp|reqwest|httpie|mechanize|selenium|cloudflare|uptime|pingdom|gtmetrix|datadog|iframely|mastodon/i;  // carryon-check: our own checks (11-05: our tests had counted as 13 downloads)
export const isBot = ua => !ua || !/^(Mozilla\/5\.0 |CarryOn-install )/.test(ua) || BOTS.test(ua);

// iPhone and iPad user agents say "like Mac OS X" too.
// The visitor's device, from the user agent (11-06: "다른 기기" was too vague).
export const device = ua => {
  ua = ua || "";
  if (/iPhone|iPod/.test(ua)) return "iphone";
  if (/iPad/.test(ua)) return "ipad";
  if (/Android/.test(ua)) return "android";
  if (/CrOS/.test(ua)) return "chromeos";
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "mac";
  if (/Linux|X11/.test(ua)) return "linux";
  return "unknown";
};
// A row's os: the file's platform when the device matches it, else "<file>@<device>" (a Mac dmg fetched on Windows is "mac@windows").
// Files: mac (the dmg) | winzip (the Windows zip) | android (the APK), and two that only send the visitor to a store:
// winstore (Microsoft Store) | ios (App Store). Older rows: "windows" was the zip until STORE_SINCE, "other" the dmg on something that is not a Mac.
export const osRow = (file, ua) => { const d = device(ua); return d === file ? file : `${file}@${d}`; };

// A visit or a click that counts: a browser whose device we can name, on the real site, without the /admin cookie.
export const ME_COOKIE = "co_me=1; Max-Age=31536000; Path=/; Secure; HttpOnly; SameSite=Lax";
export function counted(request) {
  const ua = request.headers.get("User-Agent");
  return !isBot(ua) && device(ua) !== "unknown" && new URL(request.url).hostname === HOME
    && !/(?:^|;\s*)co_me=1(?:;|$)/.test(request.headers.get("Cookie") || "");
}

// Count one click on a download or store button unless it does not count (above) or is a HEAD request, then send the
// browser on. It is the click that is counted, not a finished download. `file` is one of osRow's.
export function sendOn({ request, env, waitUntil }, to, file) {
  try {  // counting never stands in the way of the download (review #23: a missing binding threw before the 302)
    if (request.method === "GET" && counted(request))
      waitUntil(env.DB.prepare("INSERT INTO downloads (country, ref, os) VALUES (?, ?, ?)")
        // a profile link says where it is with ?s= (apps send no referrer: /download/windows?s=ytch); the tag is the row's ref
        .bind(request.cf?.country || null, srcTag(new URL(request.url).searchParams.get("s")) || refHost(request.headers.get("Referer")), osRow(file, request.headers.get("User-Agent"))).run().catch(() => {}));
  } catch {}
  return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });
}

// The host of a referrer (a URL or a bare host), lower-cased and without "www.";
// null for junk, an IP address, or `self` (the site's own host).
export function refHost(s, self = "") {
  if (typeof s !== "string" || !s || s.length > 2000) return null;
  let h;
  try { h = new URL(s.includes("://") ? s : "https://" + s).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
  if (h.length > 80 || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) || /^[\d.]+$/.test(h)) return null;
  return h === self.toLowerCase().replace(/^www\./, "") ? null : h;
}

// The beacon's body {p: path, r: referrer host, l: page language, s: the link's ?s= tag like ytch} -> a row, or null when it is not one.
export function cleanHit(text, self) {
  if (typeof text !== "string" || text.length > 1000) return null;
  let b;
  try { b = JSON.parse(text); } catch { return null; }
  if (typeof b?.p !== "string" || !/^\/[\w.~%\/-]{0,99}$/.test(b.p)) return null;
  return { path: b.p, ref: refHost(b.r, self), lang: LANGS.includes(b.l) ? b.l : null,
    src: srcTag(b.s) };
}
// A link's ?s= tag (ytch, th, x …), or null. No dot in it, so it is never taken for a referrer's host.
export const srcTag = s => typeof s === "string" && /^[A-Za-z0-9-]{1,32}$/.test(s) ? s : null;

// Constant-time compare with a secret of 32+ characters; an unset secret never matches.
export function keyOk(given, secret) {
  if (typeof given !== "string" || typeof secret !== "string" || secret.length < 32 || given.length !== secret.length) return false;
  let d = 0;
  for (let i = 0; i < secret.length; i++) d |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return d === 0;
}

// The bug form's body {what, os, ver, email, website} -> a row; null when it is not one (empty or over 2,000 characters,
// a bad email), "trap" when the hidden `website` field is filled, which only bots do.
export function cleanReport(text) {
  if (typeof text !== "string" || text.length > 10000) return null;
  let b;
  try { b = JSON.parse(text); } catch { return null; }
  if (!b || typeof b !== "object") return null;
  if (b.website) return "trap";
  const s = v => typeof v === "string" ? v.trim() : "";
  const what = s(b.what), email = s(b.email);
  if (!what || what.length > 2000) return null;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return null;
  return { what, email: email || null, os: s(b.os).slice(0, 40) || null, ver: s(b.ver).slice(0, 32) || null };
}

// A short hash of the sender's IP and the day, only to cap how many reports one place sends in a day; the IP itself is never kept.
// 6 hex characters: about 256 IPv4 addresses share each value, so it can not be turned back into one IP.
export async function who(ip, day) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(day + "|" + (ip || ""))));
  return [...h.slice(0, 3)].map(x => x.toString(16).padStart(2, "0")).join("");
}

// GitHub's per-file download counts as an app kind; SHA256SUMS and the like are not the app.
export const fileKind = name => /\.dmg$/i.test(name) ? "mac" : /\.zip$/i.test(name) ? "windows" : /\.apk$/i.test(name) ? "android" : "other";

// Daily GitHub downloads from the once-a-day copies of each file's running count (gh_assets rows {day, tag, name, count}).
// A day's number is how much the app files grew since the copy before; a file that dropped was uploaded again
// (GitHub starts it at 0), so its whole new count is that day's. The first copy of a file has nothing to compare with.
export function ghPerDay(rows) {
  const last = {}, out = {};
  for (const r of [...rows].sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : 0)) {
    if (fileKind(r.name) === "other") continue;
    const key = r.tag + "/" + r.name, prev = last[key];
    if (prev !== undefined) out[r.day] = (out[r.day] || 0) + (r.count >= prev ? r.count - prev : r.count);
    else out[r.day] = out[r.day] || 0;
    last[key] = r.count;
  }
  return out;
}

// Files uploaded again under the same name: GitHub starts such a file at 0, so what it had counted leaves GitHub's number.
// Seen as a count that fell between two daily copies, or between the last copy and `live` (GitHub's numbers right now,
// [{tag, name, count, made}], made = the Korean day the file was uploaded). -> [{tag, name, day, lost}]: `day` is the
// upload day when GitHub still tells it, else "earlier copy~later copy"; `lost` is the count before it restarted.
// ponytail: a file that passes its old count again before the next daily copy goes unseen; keep the asset id in gh_assets if that ever happens.
export function ghReuploads(snaps, live = []) {
  const made = Object.fromEntries(live.map(a => [a.tag + "/" + a.name, a.made])), last = {}, out = [];
  const see = (r, day) => {
    if (fileKind(r.name) === "other") return;
    const key = r.tag + "/" + r.name, p = last[key], m = made[key];
    if (p && r.count < p.count) out.push({ tag: r.tag, name: r.name, lost: p.count, day: m >= p.day && m <= day ? m : p.day + "~" + day });
    last[key] = { count: r.count, day };
  };
  for (const r of [...snaps].sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : 0)) see(r, r.day);
  for (const a of live) see(a, a.made);
  return out;
}

// ---- downloads rows -> the numbers ----
// Days are Korean time (UTC+9): a downloads row keeps its UTC day and time, so every row converts.
const KST = 9 * 36e5, DAYMS = 864e5;
export const kstDay = ms => new Date(ms + KST).toISOString().slice(0, 10);
export const rowTime = r => Date.parse(`${r.day}T${r.time || "00:00"}:00Z`);

// Clicks on the same button from the same country, referrer and device within this many minutes of the first are one.
// ponytail: no IP or cookie is kept, so two people who match on all of that within the window are one too; `clicks` stays
// beside every number for that reason. A short daily hash of the IP (as reports.who) would tell them apart; that is a privacy-policy change.
export const BURST_MIN = 10;
const DEVICE_SINCE = "2026-11-06";       // UTC day from which a row says the device (668fa4d); before it "windows"/"android" name the file only
const STORE_SINCE = "2026-11-11 05:57";  // UTC, when /download/windows began to go to the Microsoft Store (b39fa1f); an old-style "windows" row from then on is counted as the store
const PLAT = { mac: "mac", winzip: "windows", winstore: "windows", android: "android", ios: "ios" };
const DESKTOP = { windows: "windows", mac: "mac", linux: null, chromeos: null };  // a desktop device -> the platform whose file fits it

// A downloads row -> {kind: mac | winzip | winstore | android | ios, dev: the device, "other" (not a Mac, before devices were kept) or "?" (not kept)}.
export function rowKind(r) {
  let [f, dev] = String(r.os || "").split("@");
  if (f === "other") [f, dev] = ["mac", "other"];
  if (f === "windows") f = `${r.day} ${r.time}` >= STORE_SINCE ? "winstore" : "winzip";
  if (!(f in PLAT)) f = "mac";
  return { kind: f, dev: dev || (r.day < DEVICE_SINCE && f !== "mac" ? "?" : PLAT[f]) };
}

// downloads rows -> bursts [{day (Korean), t, country, ref, kind, dev, clicks, why}], oldest first. A burst is BURST_MIN's "one".
// `why` is null for a burst that counts, else why it looks like automatic collection (it stays in the table, out of the headline number):
//   "unknown"       the device could not be named (such requests are no longer stored)
//   "mixed"         no referrer, and the same country and device took files for two or more platforms on one day
//   "other-device"  no referrer, and a desktop took a file made for another platform (a phone tapping a shared link is a person, so phones never count here)
// ponytail: "mixed" looks at a whole day; give it a time window once one country sends dozens of no-referrer clicks a day.
export function tally(rows) {
  const open = {}, out = [];
  for (const r of rows.map(r => ({ ...r, t: rowTime(r) })).sort((a, b) => a.t - b.t)) {
    const { kind, dev } = rowKind(r), ref = r.ref || null, key = [r.country, ref, kind, dev].join("|"), b = open[key];
    if (b && r.t - b.t <= BURST_MIN * 6e4) { b.clicks++; continue; }
    out.push(open[key] = { day: kstDay(r.t), t: r.t, country: r.country || null, ref, kind, dev, clicks: 1, why: null });
  }
  // Only files can look collected: opening a store page from any device is what a person does (review #23).
  const group = b => [b.day, b.country, b.dev].join("|"), plats = {}, isFile = b => b.kind === "mac" || b.kind === "winzip" || b.kind === "android";
  for (const b of out) if (!b.ref && isFile(b)) (plats[group(b)] ||= new Set()).add(PLAT[b.kind]);
  for (const b of out) {
    b.why = b.dev === "unknown" ? "unknown" : b.ref || !isFile(b) ? null : plats[group(b)].size > 1 ? "mixed"
      : b.dev in DESKTOP && DESKTOP[b.dev] !== PLAT[b.kind] ? "other-device" : null;
  }
  return out;
}

// Everything /admin and /api/stats show, from D1. Visits (hits) are grouped by their stored day: Korean since SINCE, UTC before.
// ponytail: reads every downloads row and every daily GitHub copy (about 10,000 rows a year each); group in SQL when that is slow.
export async function numbers(db, now = Date.now()) {
  const today = kstDay(now), ago = n => kstDay(now - n * DAYMS), d7 = ago(6), d30 = ago(29), p30 = ago(59);
  const q = (sql, ...a) => db.prepare(sql).bind(...a);
  const top = col => q(`SELECT ${col} AS k, COUNT(*) AS n FROM hits WHERE day >= ? GROUP BY k ORDER BY n DESC LIMIT 12`, d30);
  const [visits, vDays, vRefs, vLangs, vSrcs, vCountries, rows, ghDaily, ghRefs, ghSnaps, reports] = (await db.batch([
    q("SELECT COUNT(*) AS total, COALESCE(SUM(day = ?), 0) AS today, COALESCE(SUM(day >= ?), 0) AS d7, COALESCE(SUM(day >= ?), 0) AS d30, COALESCE(SUM(day >= ? AND day < ?), 0) AS prev30 FROM hits", today, d7, d30, p30, d30),
    q("SELECT day, COUNT(*) AS n, COALESCE(SUM(src = 'ytch'), 0) AS yt FROM hits WHERE day >= ? GROUP BY day", d30),
    top("ref"), top("lang"), top("src"), top("country"),
    q("SELECT day, time, country, ref, os FROM downloads ORDER BY rowid"),
    q("SELECT kind, SUM(count) AS n FROM gh_daily WHERE day >= ? GROUP BY kind", d30),
    q("SELECT referrer AS k, uniques AS n FROM gh_referrers WHERE day = (SELECT MAX(day) FROM gh_referrers) ORDER BY n DESC LIMIT 10"),
    q("SELECT day, tag, name, count FROM gh_assets ORDER BY day"),
    q("SELECT day, time, country, os, ver, body, email FROM reports ORDER BY rowid DESC LIMIT 30"),
  ])).map(r => r.results);
  const bursts = tally(rows), ok = bursts.filter(b => !b.why), in30 = b => b.day >= d30;
  const span = list => ({ total: list.length, today: list.filter(b => b.day === today).length, d7: list.filter(b => b.day >= d7).length,
    d30: list.filter(in30).length, prev30: list.filter(b => b.day >= p30 && b.day < d30).length });
  const clicks = list => list.reduce((n, b) => n + b.clicks, 0);
  const by = (list, key) => { const o = {}; for (const b of list) o[key(b)] = (o[key(b)] || 0) + 1; return o; };
  const ranked = o => Object.entries(o).map(([k, n]) => ({ k: k === "null" ? null : k, n })).sort((a, b) => b.n - a.n);
  const kinds = {};
  for (const k of Object.keys(PLAT)) {
    const all = bursts.filter(b => b.kind === k && in30(b)), good = all.filter(b => !b.why);
    kinds[k] = { n: good.length, clicks: clicks(all), suspect: all.length - good.length, days: by(good, b => b.day) };
  }
  return {
    today, since: d30, visits: visits[0], visitDays: vDays, visitRefs: vRefs, visitLangs: vLangs, visitSrcs: vSrcs, visitCountries: vCountries,
    downloads: span(ok), clicks: { total: rows.length, d30: clicks(bursts.filter(in30)) },
    suspect: { total: bursts.length - ok.length, d30: bursts.filter(b => b.why && in30(b)).length },
    downloadDays: Object.entries(by(ok.filter(in30), b => b.day)).map(([day, n]) => ({ day, n })), suspectDays: by(bursts.filter(b => b.why && in30(b)), b => b.day),
    clickDays: bursts.filter(in30).reduce((o, b) => (o[b.day] = (o[b.day] || 0) + b.clicks, o), {}),
    kinds, downloadRefs: ranked(by(ok.filter(in30), b => b.ref)), downloadCountries: by(ok.filter(in30), b => b.country),
    downloadOs: ranked(by(ok.filter(in30), b => b.kind + "@" + b.dev)),
    suspects: bursts.filter(b => b.why && in30(b)).reverse(),
    ghDaily, ghRefs, ghSnaps, ghDays: ghPerDay(ghSnaps.filter(r => r.day >= ago(30))), reports,
  };
}
