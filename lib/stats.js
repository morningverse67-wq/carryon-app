// Shared by the site's Functions: what counts as a bot, what is kept of a referrer, the key check.
// Nothing here keeps an IP, a full user agent or a cookie.

export const DMG = "https://github.com/morningverse67-wq/carryon-app/releases/latest/download/CarryOn.dmg";
// ponytail: the APK is on a fixed tag, so each new APK moves this line; a latest/download name when Play or a second beta asks for it.
export const APK = "https://github.com/morningverse67-wq/carryon-app/releases/download/v1.7.0/CarryOn-android-1.7.0-beta-20.apk";
// ponytail: the Windows beta is a prerelease on a fixed tag too, so latest/download can not find it; move it with each Windows beta.
export const WINZIP = "https://github.com/morningverse67-wq/carryon-app/releases/download/v1.7.0-beta.1/CarryOn-windows-x64.zip";
export const LANGS = ["en", "ko", "ja", "zh", "de", "fr", "es", "it", "nl", "pt"];  // the site's ?lang= list

// Obvious bots, link previews and command-line tools; no user agent at all counts as one.
const BOTS = /bot|crawl|spider|slurp|archiver|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|undici|httpclient|headless|phantom|lighthouse|pagespeed|preview|externalhit|externalagent|whatsapp|embedly|vkshare|bitly|scan|monitor|carryon-check/i;  // carryon-check: our own checks (11-05: our tests had counted as 13 downloads)
export const isBot = ua => !ua || BOTS.test(ua);

// iPhone and iPad user agents say "like Mac OS X" too.
export const osClass = ua => /Macintosh|Mac OS X/.test(ua || "") && !/iPhone|iPad|iPod/.test(ua) ? "mac" : "other";

// Count one download unless it is a bot or a HEAD request, then send the browser on to the file. `os` is osClass's, "windows" or "android".
export function sendOn({ request, env, waitUntil }, to, os) {
  if (request.method === "GET" && !isBot(request.headers.get("User-Agent")) && new URL(request.url).hostname === "carryon-app.pages.dev")  // previews do not count
    waitUntil(env.DB.prepare("INSERT INTO downloads (country, ref, os) VALUES (?, ?, ?)")
      .bind(request.cf?.country || null, refHost(request.headers.get("Referer")), os).run().catch(() => {}));
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
    src: typeof b.s === "string" && /^[A-Za-z0-9-]{1,32}$/.test(b.s) ? b.s : null };
}

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
