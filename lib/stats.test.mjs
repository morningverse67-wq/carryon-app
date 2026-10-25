// node --test lib/stats.test.mjs   (no dependencies; the Functions run here against a fake D1)
import { test } from "node:test";
import assert from "node:assert/strict";
import { DMG, cleanHit, isBot, keyOk, osClass, refHost } from "./stats.js";
import { onRequest as download } from "../functions/download.js";
import { onRequestPost as hit } from "../functions/api/hit.js";
import { onRequestGet as admin } from "../functions/admin.js";

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const KEY = "k".repeat(40);

function fakeDB() {
  const rows = [];
  return { rows, prepare: sql => ({ bind: (...a) => ({ run: async () => rows.push(a) }) }),
    batch: async list => list.map((_, i) => ({ results: i < 2 ? [{ total: 3, today: 1, d7: 2, d30: 3 }] : [] })) };
}

test("bot filter", () => {
  for (const ua of ["curl/8.7.1", "Mozilla/5.0 (compatible; Googlebot/2.1)", "Mozilla/5.0 HeadlessChrome/130.0", "facebookexternalhit/1.1", "Slackbot-LinkExpanding 1.0", "", null])
    assert.equal(isBot(ua), true, String(ua));
  for (const ua of [MAC, IPHONE, WIN]) assert.equal(isBot(ua), false, ua);
});

test("os class", () => {
  assert.equal(osClass(MAC), "mac");
  assert.equal(osClass(IPHONE), "other");
  assert.equal(osClass(WIN), "other");
  assert.equal(osClass(null), "other");
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
  assert.deepEqual(cleanHit('{"p":"/","r":"news.ycombinator.com","l":"ko"}', self), { path: "/", ref: "news.ycombinator.com", lang: "ko" });
  assert.deepEqual(cleanHit('{"p":"/index.html","r":"carryon-app.pages.dev","l":"xx"}', self), { path: "/index.html", ref: null, lang: null });
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

test("/api/hit stores the cleaned beacon, skips bots", async () => {
  const post = async (body, ua = MAC) => {
    const env = { DB: fakeDB() };
    const res = await hit({ request: new Request("https://carryon-app.pages.dev/api/hit", { method: "POST", body, headers: { "User-Agent": ua } }), env });
    return [res.status, env.DB.rows];
  };
  assert.deepEqual(await post('{"p":"/","r":"www.reddit.com","l":"ja"}'), [204, [["/", "reddit.com", null, "ja"]]]);
  assert.deepEqual(await post('{"p":"/","r":"","l":"en"}', "curl/8.7.1"), [204, []]);
  assert.deepEqual(await post("garbage"), [204, []]);
});

test("/admin: 404 without the key; with it, the numbers and never the key", async () => {
  const get = k => admin({ request: new Request("https://carryon-app.pages.dev/admin" + (k ? "?k=" + k : "")), env: { DB: fakeDB(), ADMIN_KEY: KEY } });
  assert.equal((await get()).status, 404);
  assert.equal((await get("k".repeat(39) + "x")).status, 404);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 404 });  // the repo is not public yet
  try {
    const res = await get(KEY);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /CarryOn 통계/);
    assert.match(html, /아직 공개 전/);
    assert.equal(html.includes(KEY), false);
    assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
  } finally { globalThis.fetch = realFetch; }
});
