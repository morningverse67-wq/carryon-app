// Shared by the site's Functions: what counts as a bot, what is kept of a referrer, the key check.
// Nothing here keeps an IP, a full user agent or a cookie.

export const DMG = "https://github.com/morningverse67-wq/carryon-app/releases/latest/download/CarryOn.dmg";
export const LANGS = ["en", "ko", "ja", "zh"];

// Obvious bots, link previews and command-line tools; no user agent at all counts as one.
const BOTS = /bot|crawl|spider|slurp|archiver|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|undici|httpclient|headless|phantom|lighthouse|pagespeed|preview|externalhit|externalagent|whatsapp|embedly|vkshare|bitly|scan|monitor/i;
export const isBot = ua => !ua || BOTS.test(ua);

// iPhone and iPad user agents say "like Mac OS X" too.
export const osClass = ua => /Macintosh|Mac OS X/.test(ua || "") && !/iPhone|iPad|iPod/.test(ua) ? "mac" : "other";

// The host of a referrer (a URL or a bare host), lower-cased and without "www.";
// null for junk, an IP address, or `self` (the site's own host).
export function refHost(s, self = "") {
  if (typeof s !== "string" || !s || s.length > 2000) return null;
  let h;
  try { h = new URL(s.includes("://") ? s : "https://" + s).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
  if (h.length > 80 || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) || /^[\d.]+$/.test(h)) return null;
  return h === self.toLowerCase().replace(/^www\./, "") ? null : h;
}

// The beacon's body {p: path, r: referrer host, l: page language} -> a row, or null when it is not one.
export function cleanHit(text, self) {
  if (typeof text !== "string" || text.length > 1000) return null;
  let b;
  try { b = JSON.parse(text); } catch { return null; }
  if (typeof b?.p !== "string" || !/^\/[\w.~%\/-]{0,99}$/.test(b.p)) return null;
  return { path: b.p, ref: refHost(b.r, self), lang: LANGS.includes(b.l) ? b.l : null };
}

// Constant-time compare with a secret of 32+ characters; an unset secret never matches.
export function keyOk(given, secret) {
  if (typeof given !== "string" || typeof secret !== "string" || secret.length < 32 || given.length !== secret.length) return false;
  let d = 0;
  for (let i = 0; i < secret.length; i++) d |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return d === 0;
}
