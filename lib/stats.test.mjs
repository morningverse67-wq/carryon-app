// node --test lib/stats.test.mjs   (no dependencies; the Functions run here against a fake D1)
import { test } from "node:test";
import assert from "node:assert/strict";
import { APK, APPSTORE, BURST_MIN, DMG, WINSTORE, WINZIP, cleanHit, cleanReport, counted, device, isBot, keyOk, kstDay, numbers, osRow, fileKind, ghPerDay, ghReuploads, refHost, rowKind, tally, who } from "./stats.js";
import { onRequest as download } from "../functions/download.js";
import { onRequest as android } from "../functions/download/android.js";
import { onRequest as windows } from "../functions/download/windows.js";
import { onRequest as windowsZip } from "../functions/download/windows-zip.js";
import { onRequest as ios } from "../functions/download/ios.js";
import { onRequestPost as hit } from "../functions/api/hit.js";
import { onRequestGet as admin } from "../functions/admin.js";
import { onRequestGet as apiStats } from "../functions/api/stats.js";
import { onRequestPost as report } from "../functions/api/report.js";
import { onRequestPost as ghTraffic } from "../functions/api/gh-traffic.js";

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const KEY = "k".repeat(40);

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
// People in in-app browsers: they must count.
const INAPP = [
  "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36 KAKAOTALK/11.2.0 (INAPP)",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 11.2.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 Instagram 350.0.0.30.106 (iPhone15,2; iOS 18_0; ko_KR; ko; scale=3.00; 1179x2556; 650000000)",
  "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.30.106 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918N; dm3q; qcom; ko_KR; 650000000)",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 Barcelona 350.0.0.30.106 (iPhone15,2; iOS 18_0; ko_KR; ko; scale=3.00; 1179x2556; 650000000)",  // Threads
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",  // a plain in-app web view (YouTube on iPhone)
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 [FBAN/FBIOS;FBAV/480.0.0.30.108;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.0;FBLC/ko_KR]",
  "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Whale/1.0.0.0 Crosswalk/28.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.9.5)",
  "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 DaumApps/7.9.2 DaumDevice/mobile",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.16.0",
  "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  "CarryOn-install (Macintosh)",  // docs/install.sh: a person installing from the terminal
];
// Crawlers, link previews and tools, some dressed as browsers: they must not.
const CRAWLERS = [
  "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)",
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Yeti/1.1; +https://naver.me/spd)",
  "Mozilla/5.0 (compatible; Daum/4.1; +http://cs.daum.net/faq/15/4118.html?faqId=28966)",
  "facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0 BingPreview/1.0b",
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Google-InspectionTool/1.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
  "Dalvik/2.1.0 (Linux; U; Android 14; SM-S918N Build/UP1A.231005.007)",
  "AndroidDownloadManager/14 (Linux; U; Android 14; SM-S918N Build/UP1A.231005.007)",
  "python-requests/2.32.3", "Go-http-client/2.0", "Mozilla/5.0 (Windows NT; Windows NT 10.0; ko-KR) WindowsPowerShell/5.1.26100.2161", "Mozilla/5.0",
];

// A stand-in for D1: `rows` gets what each INSERT bound, `sqls` its text; SELECTs answer from `tables` by the table they read.
function fakeDB(tables = {}) {
  const rows = [], sqls = [];
  const answer = sql => /AS total.* FROM hits/.test(sql) ? [{ total: 3, today: 1, d7: 2, d30: 3, prev30: 0 }]
    : tables[(sql.match(/ FROM (downloads|gh_assets|gh_daily|reports)/) || [])[1]] || [];
  return { rows, sqls, prepare: sql => ({ sql, bind: (...a) => ({ sql, run: async () => { sqls.push(sql); rows.push(a); } }) }),
    batch: async list => list.map(st => (sqls.push(st.sql), { results: answer(st.sql) })) };
}

test("bot filter: crawlers and tools are out, people in in-app browsers are in", () => {
  for (const ua of ["curl/8.7.1", "Mozilla/5.0 (compatible; Googlebot/2.1)", "Mozilla/5.0 HeadlessChrome/130.0", "facebookexternalhit/1.1", "Slackbot-LinkExpanding 1.0", "", null, ...CRAWLERS])
    assert.equal(isBot(ua), true, String(ua));
  for (const ua of [MAC, IPHONE, WIN, ANDROID, ...INAPP]) {
    assert.equal(isBot(ua), false, ua);
    assert.notEqual(device(ua), "unknown", ua);
  }
});

test("what counts: a named device, the real host, no /admin cookie", () => {
  const req = (ua, url = "https://carryon-app.pages.dev/download", cookie) => new Request(url, { headers: { "User-Agent": ua, ...(cookie ? { Cookie: cookie } : {}) } });
  for (const ua of [MAC, ANDROID, ...INAPP]) assert.equal(counted(req(ua)), true, ua);
  for (const ua of CRAWLERS) assert.equal(counted(req(ua)), false, ua);
  assert.equal(counted(req("Mozilla/5.0 (Nintendo Switch; WifiWebAuthApplet) AppleWebKit/606.4 (KHTML, like Gecko) NF/6.0.1.15.4 NintendoBrowser/5.1.0.20393")), false);  // no device we can name
  assert.equal(counted(req(MAC, "https://stats1111.carryon-app.pages.dev/download")), false);  // a preview
  assert.equal(counted(req(MAC, undefined, "co_me=1")), false);
  assert.equal(counted(req(MAC, undefined, "a=b; co_me=1; c=d")), false);
  assert.equal(counted(req(MAC, undefined, "xco_me=1; co_me=10")), true);  // not our cookie
});

test("referrer host: host only, no www, never the site itself, no IPs or junk", () => {
  assert.equal(refHost("https://www.News.YCombinator.com/item?id=1#x"), "news.ycombinator.com");
  assert.equal(refHost("github.com"), "github.com");
  assert.equal(refHost("android-app://com.google.android.gm/"), "com.google.android.gm");
  assert.equal(refHost("https://carryon-app.pages.dev/", "carryon-app.pages.dev"), null);
  assert.equal(refHost("www.carryon-app.pages.dev", "carryon-app.pages.dev"), null);
  for (const s of ["http://192.168.0.1/a", "localhost", "not a host", "", null, 42, "https://" + "a".repeat(90) + ".com"])
    assert.equal(refHost(s), null, String(s));
});

test("beacon body", () => {
  const self = "carryon-app.pages.dev";
  assert.deepEqual(cleanHit('{"p":"/","r":"news.ycombinator.com","l":"ko"}', self), { path: "/", ref: "news.ycombinator.com", lang: "ko", src: null });
  assert.deepEqual(cleanHit('{"p":"/index.html","r":"carryon-app.pages.dev","l":"xx"}', self), { path: "/index.html", ref: null, lang: null, src: null });
  for (const l of ["en", "ko", "ja", "zh", "de", "fr", "es", "it", "nl", "pt"])
    assert.equal(cleanHit(JSON.stringify({ p: "/", l }), self).lang, l, l);
  for (const s of ["ytch", "igdm", "ig", "yt-ch-2", "a".repeat(32)])
    assert.equal(cleanHit(JSON.stringify({ p: "/", s }), self).src, s, s);
  for (const s of ["", "a".repeat(33), "yt ch", "yt_ch", "<x>", "한글", 42, null, ["ig"]])
    assert.equal(cleanHit(JSON.stringify({ p: "/", s }), self).src, null, String(s));
  for (const t of ['{"p":"x"}', '{"p":"/<script>"}', "null", "not json", '{"p":"/","x":"' + "a".repeat(1000) + '"}'])
    assert.equal(cleanHit(t, self), null, t.slice(0, 30));
});

test("key check", () => {
  assert.equal(keyOk(KEY, KEY), true);
  assert.equal(keyOk("k".repeat(39) + "x", KEY), false);
  assert.equal(keyOk(KEY + "k", KEY), false);
  assert.equal(keyOk(KEY, undefined), false);  // no secret set: nobody gets in
  assert.equal(keyOk("short", "short"), false);
  assert.equal(keyOk(null, KEY), false);
});

test("/download: 302 to the dmg; a row only for a real GET", async () => {
  const send = async (method, ua) => {
    const env = { DB: fakeDB() }, waits = [];
    const res = download({ request: new Request("https://carryon-app.pages.dev/download", { method, headers: { "User-Agent": ua, Referer: "https://news.ycombinator.com/item?id=1" } }), env, waitUntil: p => waits.push(p) });
    await Promise.all(waits);
    return [res, env.DB.rows];
  };
  const [res, rows] = await send("GET", MAC);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), DMG);
  assert.equal(DMG, "https://github.com/morningverse67-wq/carryon-app/releases/latest/download/CarryOn.dmg");
  assert.deepEqual(rows, [[null, "news.ycombinator.com", "mac"]]);
  for (const [m, ua] of [["HEAD", MAC], ["GET", "curl/8.7.1"]]) {
    const [r, none] = await send(m, ua);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("Location"), DMG);
    assert.deepEqual(none, [], m + " " + ua);
  }
});

test("/download/android: 302 to the APK on its fixed tag, never latest; the dmg link stays the dmg", async () => {
  const send = async (method, ua) => {
    const env = { DB: fakeDB() }, waits = [];
    const res = android({ request: new Request("https://carryon-app.pages.dev/download/android", { method, headers: { "User-Agent": ua } }), env, waitUntil: p => waits.push(p) });
    await Promise.all(waits);
    return [res, env.DB.rows];
  };
  const [res, rows] = await send("GET", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), APK);
  assert.match(APK, /\/releases\/download\/v\d+\.\d+\.\d+\/CarryOn-android-\d+\.\d+\.\d+-beta-\d+\.apk$/);  // a fixed tag, whatever the version
  assert.deepEqual(rows, [[null, null, "android"]]);
  const [r, none] = await send("HEAD", "Mozilla/5.0");
  assert.equal(r.headers.get("Location"), APK);
  assert.deepEqual(none, []);
});

test("/download/windows: 302 to the Microsoft Store page, os = winstore", async () => {
  const send = async (method, ua) => {
    const env = { DB: fakeDB() }, waits = [];
    const res = windows({ request: new Request("https://carryon-app.pages.dev/download/windows", { method, headers: { "User-Agent": ua } }), env, waitUntil: p => waits.push(p) });
    await Promise.all(waits);
    return [res, env.DB.rows];
  };
  const [res, rows] = await send("GET", WIN);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), WINSTORE);
  assert.match(WINSTORE, /^https:\/\/apps\.microsoft\.com\/detail\/9NFL1279L4HX$/);
  assert.deepEqual(rows, [[null, null, "winstore@windows"]]);
  for (const [m, ua] of [["HEAD", WIN], ["GET", "curl/8.7.1"]]) {
    const [r, none] = await send(m, ua);
    assert.equal(r.headers.get("Location"), WINSTORE);
    assert.deepEqual(none, [], m + " " + ua);
  }
});

test("/download/windows-zip: 302 to the beta zip, os = winzip", async () => {
  const env = { DB: fakeDB() }, waits = [];
  const res = windowsZip({ request: new Request("https://carryon-app.pages.dev/download/windows-zip", { headers: { "User-Agent": WIN } }), env, waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  assert.equal(res.headers.get("Location"), WINZIP);
  assert.deepEqual(env.DB.rows, [[null, null, "winzip@windows"]]);
});

test("/download/ios: 302 to the App Store with ct=site, counted like the other buttons", async () => {
  const send = async (ua, headers = {}) => {
    const env = { DB: fakeDB() }, waits = [];
    const res = ios({ request: new Request("https://carryon-app.pages.dev/download/ios", { headers: { "User-Agent": ua, ...headers } }), env, waitUntil: p => waits.push(p) });
    await Promise.all(waits);
    return [res, env.DB.rows];
  };
  const [res, rows] = await send(IPHONE, { Referer: "https://carryon-app.pages.dev/?s=ytch" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), APPSTORE);
  assert.match(APPSTORE, /^https:\/\/apps\.apple\.com\/kr\/app\/carryon-ai-sessions\/id6831468074\?ct=site$/);
  assert.deepEqual(rows, [[null, "carryon-app.pages.dev", "ios@iphone"]]);
  assert.deepEqual((await send(MAC))[1], [[null, null, "ios@mac"]]);
  assert.deepEqual((await send("facebookexternalhit/1.1"))[1], []);
});

test("the /admin cookie: that browser is sent on as usual and not counted, on downloads and on the beacon", async () => {
  for (const fn of [download, android, windows, windowsZip, ios]) {
    const env = { DB: fakeDB() }, waits = [];
    const res = fn({ request: new Request("https://carryon-app.pages.dev/download", { headers: { "User-Agent": MAC, Cookie: "co_me=1" } }), env, waitUntil: p => waits.push(p) });
    await Promise.all(waits);
    assert.equal(res.status, 302);
    assert.ok(res.headers.get("Location"));
    assert.deepEqual(env.DB.rows, []);
  }
  const post = async (url, headers) => {
    const env = { DB: fakeDB() };
    await hit({ request: new Request(url, { method: "POST", body: '{"p":"/","r":"","l":"ko"}', headers: { "User-Agent": MAC, ...headers } }), env });
    return env.DB;
  };
  assert.equal((await post("https://carryon-app.pages.dev/api/hit", { Cookie: "co_me=1" })).rows.length, 0);
  assert.equal((await post("https://stats1111.carryon-app.pages.dev/api/hit", {})).rows.length, 0);  // a preview's visits are ours too
  const db = await post("https://carryon-app.pages.dev/api/hit", {});
  assert.equal(db.rows.length, 1);
  assert.match(db.sqls[0], /date\('now', '\+9 hours'\)/);  // a visit's day is the Korean day
});

test("/api/hit stores the cleaned beacon, skips bots", async () => {
  const post = async (body, ua = MAC) => {
    const env = { DB: fakeDB() };
    const res = await hit({ request: new Request("https://carryon-app.pages.dev/api/hit", { method: "POST", body, headers: { "User-Agent": ua } }), env });
    return [res.status, env.DB.rows];
  };
  assert.deepEqual(await post('{"p":"/","r":"www.reddit.com","l":"ja"}'), [204, [["/", "reddit.com", null, "ja", null]]]);
  assert.deepEqual(await post('{"p":"/","r":"","l":"ko","s":"ytch"}'), [204, [["/", null, null, "ko", "ytch"]]]);
  assert.deepEqual(await post('{"p":"/","r":"","l":"en"}', "curl/8.7.1"), [204, []]);
  assert.deepEqual(await post("garbage"), [204, []]);
});

// Made-up rows in the table's shape (UTC day and time): one person tapping three times, a crawler taking every
// platform's file, a desktop taking a phone's file, an unnamed device, rows from before devices were kept.
const ROWS = [
  { day: "2026-10-26", time: "12:00", country: "CA", ref: null, os: "other" },                      // the dmg on something that is not a Mac, before devices were kept
  { day: "2026-11-05", time: "09:00", country: "KR", ref: "carryon-app.pages.dev", os: "windows" }, // then: "windows" was the zip, device not kept
  { day: "2026-11-05", time: "09:00", country: "KR", ref: "carryon-app.pages.dev", os: "windows" },
  { day: "2026-11-09", time: "08:10", country: "KR", ref: "youtube.com", os: "windows@android" },   // one person, three taps in 8 minutes
  { day: "2026-11-09", time: "08:10", country: "KR", ref: "youtube.com", os: "windows@android" },
  { day: "2026-11-09", time: "08:18", country: "KR", ref: "youtube.com", os: "windows@android" },
  { day: "2026-11-09", time: "08:21", country: "KR", ref: "youtube.com", os: "windows@android" },   // 11 minutes after the first: a new one
  { day: "2026-11-09", time: "16:00", country: "CA", ref: null, os: "mac@unknown" },                // a device with no name (01:00 on 11-10 in Korea)
  { day: "2026-11-10", time: "04:00", country: "NO", ref: null, os: "windows" },                    // a Windows PC, no referrer, taking the zip …
  { day: "2026-11-10", time: "04:40", country: "NO", ref: null, os: "mac@windows" },                // … the dmg …
  { day: "2026-11-10", time: "12:30", country: "NO", ref: null, os: "android@windows" },            // … and the APK, the same Korean day
  { day: "2026-11-10", time: "04:10", country: "AT", ref: null, os: "android@windows" },            // a desktop taking a phone's file, alone
  { day: "2026-11-10", time: "02:00", country: "DK", ref: null, os: "windows" },                    // the zip on Windows: nothing odd
  { day: "2026-11-10", time: "05:00", country: "KR", ref: null, os: "mac@iphone" },                 // a phone opening a shared link is a person
  { day: "2026-11-10", time: "16:30", country: "KR", ref: "carryon-app.pages.dev", os: "mac" },     // 01:30 the next day in Korea
  { day: "2026-11-11", time: "05:56", country: "KR", ref: "carryon-app.pages.dev", os: "windows" }, // the last minute of the zip
  { day: "2026-11-11", time: "05:57", country: "JP", ref: "carryon-app.pages.dev", os: "windows" }, // old-style row once the button went to the store
  { day: "2026-11-12", time: "01:00", country: "JP", ref: "carryon-app.pages.dev", os: "winstore@windows" },
  { day: "2026-11-12", time: "01:05", country: "JP", ref: "carryon-app.pages.dev", os: "winzip@windows" },
  { day: "2026-11-12", time: "02:00", country: "US", ref: "carryon-app.pages.dev", os: "ios@iphone" },
];

test("a row's kind and device, old rows included", () => {
  const k = (os, day = "2026-11-10", time = "00:00") => rowKind({ os, day, time });
  assert.deepEqual(k("mac"), { kind: "mac", dev: "mac" });
  assert.deepEqual(k("mac@windows"), { kind: "mac", dev: "windows" });
  assert.deepEqual(k("other", "2026-10-26"), { kind: "mac", dev: "other" });
  assert.deepEqual(k("windows", "2026-11-05"), { kind: "winzip", dev: "?" });      // before devices were kept
  assert.deepEqual(k("android", "2026-11-05"), { kind: "android", dev: "?" });
  assert.deepEqual(k("windows", "2026-11-10"), { kind: "winzip", dev: "windows" }); // "windows" stays the zip …
  assert.deepEqual(k("windows", "2026-11-11", "05:56"), { kind: "winzip", dev: "windows" });
  assert.deepEqual(k("windows", "2026-11-11", "05:57"), { kind: "winstore", dev: "windows" });  // … until the button went to the store
  assert.deepEqual(k("winzip@windows", "2026-11-12"), { kind: "winzip", dev: "windows" });
  assert.deepEqual(k("winstore@android", "2026-11-12"), { kind: "winstore", dev: "android" });
  assert.deepEqual(k("ios@iphone", "2026-11-12"), { kind: "ios", dev: "iphone" });
});

test("tally: clicks close together are one, automatic collection is set aside, days are Korean", () => {
  const b = tally(ROWS), of = (country, kind) => b.filter(x => x.country === country && x.kind === kind);
  assert.equal(BURST_MIN, 10);
  assert.equal(ROWS.length, 20);
  assert.equal(b.length, 17);                                         // 20 clicks, 17 bursts …
  assert.equal(b.reduce((n, x) => n + x.clicks, 0), 20);
  assert.equal(b.filter(x => !x.why).length, 12);                     // … 12 that count
  assert.deepEqual(of("KR", "winzip").map(x => [x.day, x.clicks]), [["2026-11-05", 2], ["2026-11-09", 3], ["2026-11-09", 1], ["2026-11-11", 1]]);
  assert.deepEqual(of("CA", "mac").map(x => x.why), [null, "unknown"]);  // the old "other" row counts: its device was never kept
  assert.deepEqual(of("NO", "winzip").concat(of("NO", "mac"), of("NO", "android")).map(x => x.why), ["mixed", "mixed", "mixed"]);
  assert.deepEqual(of("AT", "android").map(x => x.why), ["other-device"]);
  assert.deepEqual(of("DK", "winzip").map(x => x.why), [null]);
  assert.deepEqual(of("KR", "mac").map(x => [x.dev, x.day, x.why]), [["iphone", "2026-11-10", null], ["mac", "2026-11-11", null]]);  // 16:30 UTC is the next day in Korea
  assert.deepEqual(of("JP", "winstore").map(x => x.day), ["2026-11-11", "2026-11-12"]);
  assert.deepEqual(of("JP", "winzip").map(x => x.clicks), [1]);       // the store and the zip are different buttons
  assert.deepEqual(of("US", "ios").map(x => [x.dev, x.why]), [["iphone", null]]);
  assert.equal(kstDay(Date.parse("2026-11-10T14:59:00Z")), "2026-11-10");
  assert.equal(kstDay(Date.parse("2026-11-10T15:00:00Z")), "2026-11-11");
});

test("numbers(): what /admin and /api/stats show, for one moment in time", async () => {
  const n = await numbers(fakeDB({ downloads: ROWS }), Date.parse("2026-11-12T03:00:00Z"));  // noon on 11-12 in Korea
  assert.equal(n.today, "2026-11-12");
  assert.deepEqual(n.clicks, { total: 20, d30: 20 });
  assert.deepEqual(n.downloads, { total: 12, today: 3, d7: 10, d30: 12, prev30: 0 });
  assert.deepEqual(n.suspect, { total: 5, d30: 5 });
  assert.deepEqual(Object.fromEntries(Object.entries(n.kinds).map(([k, x]) => [k, [x.n, x.clicks, x.suspect]])),
    { mac: [3, 5, 2], winzip: [6, 10, 1], winstore: [2, 2, 0], android: [0, 2, 2], ios: [1, 1, 0] });
  assert.equal(n.kinds.winzip.days["2026-11-09"], 2);
  assert.deepEqual(n.suspectDays, { "2026-11-10": 5 });
  assert.deepEqual(n.downloadDays.find(x => x.day === "2026-11-09"), { day: "2026-11-09", n: 2 });
  assert.equal(n.clickDays["2026-11-09"], 4);
  assert.deepEqual(n.downloadRefs[0], { k: "carryon-app.pages.dev", n: 7 });  // the site's own buttons
  assert.equal(n.downloadCountries.KR, 6);
  assert.equal(n.suspects.length, 5);
  assert.equal(n.visits.d30, 3);
});

test("/admin: 404 without the key; with it, the numbers, the cookie that keeps this browser out, never the key", async () => {
  const get = k => admin({ request: new Request("https://carryon-app.pages.dev/admin" + (k ? "?k=" + k + "&full=1" : "")), env: { DB: fakeDB({ downloads: ROWS }), ADMIN_KEY: KEY } });
  for (const res of [await get(), await get("k".repeat(39) + "x")]) {
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("Set-Cookie"), null);
  }
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 404 });  // the repo is not public yet
  try {
    const res = await get(KEY);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /CarryOn 통계/);
    assert.match(html, /아직 공개 전/);
    for (const label of ["Mac DMG", "Windows ZIP", "Android APK", "Windows · Microsoft Store", "iPhone · App Store", "파일 받기", "스토어로 이동", "자동 수집 의심", "누름", "한국 시간", "방문자에게는 쿠키를 주지 않아요"])
      assert.ok(html.includes(label), label);
    assert.equal(html.includes(KEY), false);
    assert.equal(/<script/i.test(html), false);  // the page's CSP allows none
    assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
    assert.equal(res.headers.get("Set-Cookie"), "co_me=1; Max-Age=31536000; Path=/; Secure; HttpOnly; SameSite=Lax");
  } finally { globalThis.fetch = realFetch; }
});

test("/admin shows its own page (no redirect); /api/stats needs the Bearer key", async () => {
  const env = { DB: fakeDB({ downloads: ROWS }), ADMIN_KEY: KEY };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json([]);
  try {
    const res = await admin({ request: new Request("https://carryon-app.pages.dev/admin?k=" + KEY), env });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /CarryOn 통계/);
  } finally { globalThis.fetch = realFetch; }
  const api = h => apiStats({ request: new Request("https://carryon-app.pages.dev/api/stats", { headers: h }), env });
  assert.equal((await api({})).status, 404);
  assert.equal((await api({ Authorization: "Bearer wrong" })).status, 404);
  const ok = await api({ Authorization: "Bearer " + KEY });
  assert.equal(ok.status, 200);
  const json = await ok.json();
  assert.equal(json.visits.total, 3);
  assert.equal(json.downloads.total, 12);  // bursts that count
  assert.equal(json.clicks.total, 20);     // every click
  assert.equal("ghSnaps" in json, false);
});

test("/download: our own checks and preview hosts are not counted", async () => {
  for (const [url, ua] of [["https://carryon-app.pages.dev/download", "Mozilla/5.0 carryon-check"],
                           ["https://abc123.carryon-app.pages.dev/download", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"]]) {
    const env = { DB: fakeDB() }, waits = [];
    const res = download({ request: new Request(url, { headers: { "User-Agent": ua } }), env, waitUntil: p => waits.push(p) });
    await Promise.all(waits);
    assert.equal(res.status, 302);
    assert.deepEqual(env.DB.rows, []);
  }
});

test("/api/report: stores a report, refuses empty or long ones and bad emails, drops the hidden field, caps 5 a day", async () => {
  const rows = [];
  const DB = { prepare: sql => ({ bind: (...a) => ({
    first: async () => ({ n: rows.filter(r => r[0] === a[0] && r[6] === a[1]).length }),
    run: async () => rows.push(a) }) }) };
  const post = (body, ip = "203.0.113.7") => report({ request: new Request("https://carryon-app.pages.dev/api/report", {
    method: "POST", body: JSON.stringify(body), headers: { "User-Agent": MAC, "CF-Connecting-IP": ip } }), env: { DB } }).then(r => r.status);
  assert.equal(await post({ what: "  Compact button does nothing  ", os: "macOS", ver: "1.7.0", email: "a@b.co", website: "" }), 204);
  assert.equal(rows.length, 1);
  const [day, country, os, ver, body, email, w] = rows[0];
  assert.deepEqual([country, os, ver, body, email], [null, "macOS", "1.7.0", "Compact button does nothing", "a@b.co"]);
  assert.equal(day, new Date().toISOString().slice(0, 10));
  assert.match(w, /^[0-9a-f]{6}$/);
  assert.equal(JSON.stringify(rows).includes("203.0.113.7"), false);  // never the IP
  for (const bad of [{ what: "" }, { what: "   " }, { what: "x".repeat(2001) }, { what: "ok", email: "not-an-email" }, {}])
    assert.equal(await post(bad), 400, JSON.stringify(bad).slice(0, 40));
  assert.equal(await post({ what: "spam", website: "http://x" }), 204);  // the hidden field: looks sent, nothing stored
  assert.equal(rows.length, 1);
  for (let i = 0; i < 4; i++) assert.equal(await post({ what: "again " + i }), 204);
  assert.equal(await post({ what: "sixth" }), 429);
  assert.equal(await post({ what: "other place" }, "198.51.100.1"), 204);
  assert.equal(cleanReport(JSON.stringify({ what: "x".repeat(2000) })).what.length, 2000);
  assert.equal(await who("203.0.113.7", "2026-11-05"), await who("203.0.113.7", "2026-11-05"));
  assert.notEqual(await who("203.0.113.7", "2026-11-05"), await who("203.0.113.7", "2026-11-06"));
});

test("device and the row's os say which file went to which device", () => {
  assert.equal(device(MAC), "mac"); assert.equal(device(IPHONE), "iphone"); assert.equal(device(WIN), "windows");
  assert.equal(device("Mozilla/5.0 (X11; Linux x86_64)"), "linux"); assert.equal(device("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), "android");
  assert.equal(device("Mozilla/5.0 (X11; FreeBSD amd64; rv:130.0) Gecko/20100101 Firefox/130.0"), "linux");
  assert.equal(device(null), "unknown");
  assert.equal(osRow("mac", MAC), "mac"); assert.equal(osRow("mac", WIN), "mac@windows"); assert.equal(osRow("winzip", WIN), "winzip@windows");
  assert.equal(osRow("android", IPHONE), "android@iphone"); assert.equal(osRow("ios", IPHONE), "ios@iphone");
});

test("GitHub per day: growth between daily copies, a re-upload counts from 0, checksum files ignored", () => {
  const rows = [
    { day: "2026-11-10", tag: "v1.7.0", name: "CarryOn.dmg", count: 3 },
    { day: "2026-11-10", tag: "v1.7.0", name: "SHA256SUMS.txt", count: 0 },
    { day: "2026-11-11", tag: "v1.7.0", name: "CarryOn.dmg", count: 8 },
    { day: "2026-11-11", tag: "v1.7.0", name: "SHA256SUMS.txt", count: 4 },
    { day: "2026-11-12", tag: "v1.7.0", name: "CarryOn.dmg", count: 2 },  // uploaded again: GitHub restarted at 0
    { day: "2026-11-12", tag: "v1.7.0-beta.1", name: "CarryOn-windows-x64.zip", count: 21 },  // first copy: nothing to compare
  ];
  assert.deepEqual(ghPerDay(rows), { "2026-11-10": 0, "2026-11-11": 5, "2026-11-12": 2 });
  assert.equal(fileKind("CarryOn-android-1.7.0-beta-20.apk"), "android");
  assert.equal(fileKind("SHA256SUMS-windows.txt"), "other");
});

test("GitHub re-uploads: found from the daily copies and from GitHub's numbers right now, with what was lost", () => {
  const snaps = [
    { day: "2026-11-09", tag: "v1.7.0", name: "CarryOn.dmg", count: 3 },
    { day: "2026-11-10", tag: "v1.7.0", name: "CarryOn.dmg", count: 5 },
    { day: "2026-11-11", tag: "v1.7.0", name: "CarryOn.dmg", count: 6 },
    { day: "2026-11-11", tag: "v1.7.0", name: "SHA256SUMS.txt", count: 1 },
    { day: "2026-11-11", tag: "v1.7.0-beta.1", name: "CarryOn-windows-x64.zip", count: 24 },
  ];
  assert.deepEqual(ghReuploads(snaps), []);
  // GitHub now shows fewer than this morning's copy: uploaded again today, 6 downloads no longer in GitHub's number.
  const live = [{ tag: "v1.7.0", name: "CarryOn.dmg", count: 2, made: "2026-11-11" }, { tag: "v1.7.0", name: "SHA256SUMS.txt", count: 0, made: "2026-11-11" },
    { tag: "v1.7.0-beta.1", name: "CarryOn-windows-x64.zip", count: 25, made: "2026-11-04" }];
  assert.deepEqual(ghReuploads(snaps, live), [{ tag: "v1.7.0", name: "CarryOn.dmg", lost: 6, day: "2026-11-11" }]);
  // The next morning's copy sees the same fall: still one entry, the same day and the same loss.
  const next = [...snaps, { day: "2026-11-12", tag: "v1.7.0", name: "CarryOn.dmg", count: 4 }];
  assert.deepEqual(ghReuploads(next, [{ ...live[0], count: 4 }]), [{ tag: "v1.7.0", name: "CarryOn.dmg", lost: 6, day: "2026-11-11" }]);
  // Without GitHub's upload day (the API did not answer), the two copies it happened between.
  assert.deepEqual(ghReuploads(next), [{ tag: "v1.7.0", name: "CarryOn.dmg", lost: 6, day: "2026-11-11~2026-11-12" }]);
});

test("/admin: GitHub downloads per platform and per release, re-uploads found, with what the number means", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json([
    { tag_name: "v1.7.0", published_at: "2026-11-04T19:15:11Z", prerelease: false, assets: [{ name: "CarryOn.dmg", download_count: 3, created_at: "2026-11-11T05:42:00Z" }, { name: "CarryOn-android-1.7.0-beta-20.apk", download_count: 9, created_at: "2026-11-04T19:15:11Z" }, { name: "SHA256SUMS.txt", download_count: 1, created_at: "2026-11-11T05:42:00Z" }] },
    { tag_name: "v1.7.0-beta.1", published_at: "2026-11-04T14:51:54Z", prerelease: true, assets: [{ name: "CarryOn-windows-x64.zip", download_count: 21, created_at: "2026-11-04T14:51:54Z" }] },
  ]);
  const gh_assets = [{ day: "2026-11-10", tag: "v1.7.0", name: "CarryOn.dmg", count: 5 }, { day: "2026-11-11", tag: "v1.7.0", name: "CarryOn.dmg", count: 6 }];
  try {
    const html = await (await admin({ request: new Request("https://carryon-app.pages.dev/admin?k=" + KEY), env: { DB: fakeDB({ gh_assets }), ADMIN_KEY: KEY } })).text();
    assert.match(html, /앱 파일 · 누적<\/span><b>33</);
    assert.match(html, /Windows ZIP<\/span><b>21</);
    assert.match(html, /v1\.7\.0-beta\.1 <small>베타/);
    assert.match(html, /<td class="d">11-05<\/td>/);  // 19:15 UTC on 11-04 is 11-05 in Korea
    assert.match(html, /횟수예요\(사람 수 아님\)/);
    assert.match(html, /일별 GitHub 파일 받기/);
    assert.match(html, /<td>v1\.7\.0 CarryOn\.dmg<\/td><td class="d">11-11<\/td><td class="n">6<\/td>/);  // found, not a fixed sentence
    assert.match(html, /다시 올려 빠진 6회는 아래 표/);
    assert.match(html, /매일 기록은 11-10부터 있어요/);
  } finally { globalThis.fetch = realFetch; }
});

test("/api/gh-traffic: needs the ingest key; the files' counts and the referrers are filed under the Korean day", async () => {
  const body = k => JSON.stringify({ k, views: { views: [{ timestamp: "2026-11-10T00:00:00Z", count: 7, uniques: 2 }] }, clones: { clones: [] },
    referrers: [{ referrer: "github.com", count: 1, uniques: 1 }], assets: [{ tag: "v1.7.0", name: "CarryOn.dmg", count: 6 }] });
  const post = async k => { const env = { DB: fakeDB(), INGEST_KEY: KEY }; const res = await ghTraffic({ request: new Request("https://carryon-app.pages.dev/api/gh-traffic", { method: "POST", body: body(k) }), env }); return [res, env.DB.sqls]; };
  assert.equal((await post("wrong"))[0].status, 404);
  const [res, sqls] = await post(KEY);
  assert.deepEqual(await res.json(), { ok: true, statements: 4 });
  for (const sql of sqls.filter(x => /gh_assets|gh_referrers/.test(x))) assert.match(sql, /date\('now', '\+9 hours'\)/, sql);
  assert.equal(sqls.filter(x => /gh_assets|gh_referrers/.test(x)).length, 3);
});

test("review #23: store pages never look collected, and counting never blocks the redirect", async () => {
  const { tally, sendOn } = await import("./stats.js");
  // a Mac with no referrer opens the App Store page and takes the dmg on one day: both count
  const bs = tally([{ day: "2026-11-12", time: "01:00", country: "KR", ref: null, os: "mac" }, { day: "2026-11-12", time: "03:00", country: "KR", ref: null, os: "ios@mac" }]);
  assert.deepEqual(bs.map(b => b.why), [null, null]);
  // a desktop that takes two platforms' files with no referrer is still "mixed"
  const mixed = tally([{ day: "2026-11-12", time: "01:00", country: "FI", ref: null, os: "mac@windows" }, { day: "2026-11-12", time: "01:01", country: "FI", ref: null, os: "android@windows" }]);
  assert.deepEqual(mixed.map(b => b.why), ["mixed", "mixed"]);
  // env.DB missing: still a 302
  const res = sendOn({ request: new Request("https://carryon-app.pages.dev/download", { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15" } }), env: {}, waitUntil: () => {} }, "https://example.com/x.dmg", "mac");
  assert.equal(res.status, 302);
});
